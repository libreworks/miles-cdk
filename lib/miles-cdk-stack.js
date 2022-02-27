const cdk = require("@aws-cdk/core");
const DataPlane = require("./data-plane");
const ControlPlane = require("./control-plane");

class MilesCdkStack extends cdk.Construct {
  /**
   *
   * @param {cdk.Construct} scope
   * @param {string} id
   * @param {cdk.StackProps=} props
   */
  constructor(scope, id, props) {
    super(scope, id);

    const dataPlane = new DataPlane(this, "data", {});
    const controlPlane = new ControlPlane(this, "ctrl", {});
  }
}

module.exports = { MilesCdkStack };
