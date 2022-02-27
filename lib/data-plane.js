const { Stack, Duration } = require("@aws-cdk/core");
const { Key } = require("@aws-cdk/aws-kms");
const { CfnDatabase, CfnTable } = require("@aws-cdk/aws-timestream");
const {
  Table,
  TableEncryption,
  AttributeType,
  BillingMode,
  StreamViewType,
} = require("@aws-cdk/aws-dynamodb");

/**
 * Creates the stack that houses our data.
 */
class DataPlane extends Stack {
  /**
   * Creates a new stack.
   *
   * @param {Object} scope - Parent of this stack.
   * @param {string} id - The construct ID of this stack.
   * @param {Object} props - Stack properties.
   */
  constructor(scope, id, props) {
    super(scope, id);

    const dynamoEncryptionKey = new Key(this, "dynamo-key", {
      enabled: true,
      enableKeyRotation: true,
      description: "Encrypts Miles data in DynamoDB",
      pendingWindow: Duration.days(7),
    });
    const dynamoUrls = new Table(this, "urls", {
      tableName: "miles-urls",
      partitionKey: {
        name: "id",
        type: AttributeType.STRING,
      },
      encryption: TableEncryption.CUSTOMER_MANAGED,
      encryptionKey: dynamoEncryptionKey,
      billingMode: BillingMode.PAY_PER_REQUEST,
      stream: StreamViewType.NEW_IMAGE,
    });

    const timeStreamKey = new Key(this, "ts-key", {
      enabled: true,
      enableKeyRotation: true,
      description: "Encrypts Miles data in Timestream",
      pendingWindow: Duration.days(7),
    });
    const timeStreamDb = new CfnDatabase(this, "ts-db", {
      databaseName: "miles-metrics",
      kmsKeyId: timeStreamKey.keyId,
    });
    const timeStreamTable = new CfnTable(this, "ts-table", {
      databaseName: "miles-metrics",
      tableName: "latency",
      retentionProperties: {
        MemoryStoreRetentionPeriodInHours: 24,
        MagneticStoreRetentionPeriodInDays: 14,
      },
    });
    timeStreamTable.addDependsOn(timeStreamDb);
  }
}

module.exports = DataPlane;
