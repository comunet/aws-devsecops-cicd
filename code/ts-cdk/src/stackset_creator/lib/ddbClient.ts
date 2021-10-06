import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import * as cdk from '@aws-cdk/core';

// Create an Amazon DynamoDB service client object.
const {fromIni} = require("@aws-sdk/credential-provider-ini");

let app = new cdk.App();
const l_profile = app.node.tryGetContext('awsprofile') || '';

var ddbClient :DynamoDBClient;

if(l_profile != ""){
  ddbClient = new DynamoDBClient({
    credentials: fromIni({profile: l_profile})
  });
} else {
  ddbClient = new DynamoDBClient({});
}

export { ddbClient };