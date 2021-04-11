const { expect, matchTemplate, MatchStyle } = require("@aws-cdk/assert");
const cdk = require("@aws-cdk/core");
const MilesCdk = require("../lib/miles-cdk-stack");

test("Empty Stack", () => {
  const app = new cdk.App();
  // WHEN
  const stack = new MilesCdk.MilesCdkStack(app, "MyTestStack");
  // THEN
  expect(stack).to(
    matchTemplate(
      {
        Resources: {},
      },
      MatchStyle.EXACT
    )
  );
});
