const {
  LambdaRestApi,
  CfnAuthorizer,
  LambdaIntegration,
  AuthorizationType,
} = require("@aws-cdk/aws-apigateway");
const { InlineCode, Function, Runtime } = require("@aws-cdk/aws-lambda");
const { UserPool, UserPoolClient, Mfa, AccountRecovery, CfnUserPoolGroup } = require("@aws-cdk/aws-cognito");
const { Stack, Duration, CfnOutput } = require("@aws-cdk/core");

/**
 * Creates the stack that houses our API.
 */
class ControlPlane extends Stack {
  /**
   * Creates a new stack.
   *
   * @param {Object} scope - Parent of this stack.
   * @param {string} id - The construct ID of this stack.
   * @param {Object} props - Stack properties.
   */
  constructor(scope, id, props) {
    super(scope, id);

    // Function that returns 201 with "Hello world!"
    const helloWorldFunction = new Function(this, "helloWorldFunction", {
      code: new InlineCode(
        'exports.handler = async (event = {}) => { console.log(event); return { statusCode: 201, body: "Hello world!" }; };'
      ),
      handler: "index.handler",
      runtime: Runtime.NODEJS_14_X,
    });

    // Rest API backed by the helloWorldFunction
    // https://h3e62dtc4b.execute-api.us-east-1.amazonaws.com/prod/
    const helloWorldLambdaRestApi = new LambdaRestApi(
      this,
      "helloWorldLambdaRestApi",
      {
        restApiName: "Hello World API",
        handler: helloWorldFunction,
        proxy: false,
      }
    );

    // Cognito User Pool with Email Sign-in Type.
    const userPool = new UserPool(this, "userPool", {
      signInAliases: {
        email: true,
      },
      selfSignUpEnabled: false,
      mfa: Mfa.OPTIONAL,
      mfaSecondFactor: {"otp":true,"sms":false},
      accountRecovery: AccountRecovery.EMAIL_ONLY,
    });

    // Cognito User Pool Client.
    const userPoolClient = new UserPoolClient(this, "userPoolClient", {
      userPool: userPool,
      userPoolClientName: "Miles CLI",
      accessTokenValidity: Duration.days(1),
      idTokenValidity: Duration.days(1),
      refreshTokenValidity: Duration.days(365),
      generateSecret: false,
    });

    const adminGroup = new CfnUserPoolGroup(this, "userPoolAdmins", {
      userPoolId: userPool.userPoolId,
      description: "For Miles administrators",
      groupName: "Admins",
    });
    const viewerGroup = new CfnUserPoolGroup(this, "userPoolViewers", {
      userPoolId: userPool.userPoolId,
      description: "For Miles users with read-only access",
      groupName: "Viewers",
    });

    new CfnOutput(this, "userPoolId", {
      value: userPool.userPoolId,
    });
    new CfnOutput(this, "userPoolClientId", {
      value: userPoolClient.userPoolClientId,
    });

    // we can do username/password authentication
    // we should store the JWT in a cache directory
    // use https://www.npmjs.com/package/amazon-cognito-identity-js for signin.

    // Authorizer for the Hello World API that uses the
    // Cognito User pool to Authorize users.
    const authorizer = new CfnAuthorizer(this, "cfnAuth", {
      restApiId: helloWorldLambdaRestApi.restApiId,
      name: "HelloWorldAPIAuthorizer",
      type: "COGNITO_USER_POOLS",
      identitySource: "method.request.header.Authorization",
      providerArns: [userPool.userPoolArn],
    });

    // Hello Resource API for the REST API.
    const hello = helloWorldLambdaRestApi.root.addResource("HELLO");

    // GET method for the HELLO API resource. It uses Cognito for
    // authorization and the auathorizer defined above.
    hello.addMethod("GET", new LambdaIntegration(helloWorldFunction), {
      authorizationType: AuthorizationType.COGNITO,
      authorizer: {
        authorizerId: authorizer.ref,
      },
    });
  }
}

module.exports = ControlPlane;
