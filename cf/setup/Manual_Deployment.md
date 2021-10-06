# AWS DevSecOps CI/CD Framework for AWS Organisations (v2) - Manual Deployment

For ease of readability, the Manual Deployment steps have been moved into this separate document from the [README.md] file.

For all other details of using the DevSecOps Framework please refer to the [README.md] file.

### 3.3 MANUAL DEPLOYMENT
If you prefer the Manual Deployment, steps are outlined below.

#### 3.3.1 Set deployment variables <!-- omit in toc -->
Open a bash terminal and run lines below to setup some bash variables which will be reused across script installations:
```
AWSDeploymentAccountNumber="AWSACCNUMBER-DEPLOYMENTACCOUNT"
AWSManagementAccountNumber="AWSACCNUMBER-MANAGEMENTACCOUNT"
profileDeploymentAccount="PROFILE-ORG-DEPLOYMENTACCOUNT"
profileManagementAccount="PROFILE-ORG-MANAGEMENTACCOUNT"
projectResourcePrefix="PROJECT-RESOURCE-PREFIX"
projectFriendlyName="PROJECT-FRIENDLY-NAME" 
emailFailedBuildNotifications="EMAIL-ADDR-FAILEDBUILD"
emailApprovalNotifications="EMAIL-ADDR-APPROVALNOTIFICATIONS"
environmentType="prod"
awsregion="AWS-REGION"
codeCommitRepoName="${projectResourcePrefix}-repo"
codeCommitBranchName="main"
s3ArtifactsBucket="${projectResourcePrefix}-${environmentType}-artifacts-lambda"
msTeamsHostName="MSTEAMS-HOSTNAME"
msTeamsWebHookPath="MSTEAMS-WEBHOOKPATH"
slackChannelName="SLACK-CHANNELNAME"
slackWebHookPath="SLACK-WEBHOOKPATH"
printf "Done"

```

#### 3.3.2 Upload Slack/MS Teams Settings to AWS Secrets in DEPLOYMENT account [OPTIONAL] <!-- omit in toc -->
1. Create local variables to be used as Secret Values.
   * **[For Slack Integration]**
		Assuming you have performed (step 3.2.2.1 above) and replace script placeholders (3.1)
	```
	secretName="SlackSettings"
	secretValue="{\"slackChannelName\":\"${slackChannelName}\",\"slackWebHookPath\":\"${slackWebHookPath}\"}"
	```
	* **[MS Teams Integration]**
Assuming you have performed (step 3.2.2.1 above) and replace script placeholders (3.1)
	```
	secretName="MSTeamsSettings"
	secretValue="{\"msTeamsHostname\":\"${msTeamsHostName}\",\"msTeamsWebHookPath\":\"${msTeamsWebHookPath}\"}"
	```

2. Create Secrets
```
aws secretsmanager create-secret --name $secretName --secret-string $secretValue --profile $profileDeploymentAccount --region $awsregion
```

#### Updating Slack/Teams AWS Secrets <!-- omit in toc -->

 > Note: If you need to update your secret values you can use the following script. 
```
aws secretsmanager update-secret --secret-id $secretName --secret-string $secretValue --profile $profileDeploymentAccount --region $awsregion
```

#### 3.3.3 Setup CodeCommit Repo in DEPLOYMENT account <!-- omit in toc -->
1. Compile the CloudFormation script
```
aws cloudformation package --template-file ./cf/setup/01_create_codecommit_repo.yaml --output-template-file ./.build/_01_create_codecommit_repo.yaml --s3-bucket NOTUSED --profile $profileDeploymentAccount
```

2. Deploy the CloudFormation script
```
aws cloudformation deploy --template-file ./.build/_01_create_codecommit_repo.yaml --stack-name "${projectResourcePrefix}-setup-codecommit-repo" --profile $profileDeploymentAccount --region $awsregion --capabilities CAPABILITY_NAMED_IAM --parameter-overrides ProjectResourcePrefix=$projectResourcePrefix
```

#### 3.3.4 Deploy the S3 Bucket for Build Artifacts with Policy + KMS Key to DEPLOYMENT Account <!-- omit in toc -->
1. Compile the CloudFormation script
```
aws cloudformation package --template-file ./cf/setup/02_deployment_artifacts_bucket.yaml --output-template-file "./.build/_02_deployment_artifacts_bucket.yaml" --s3-bucket NOTUSED --profile $profileDeploymentAccount
```

2. Deploy the CloudFormation script
```
aws cloudformation deploy --template-file "./.build/_02_deployment_artifacts_bucket.yaml" --stack-name "${projectResourcePrefix}-setup-artif-${environmentType}" --profile $profileDeploymentAccount --region $awsregion --capabilities CAPABILITY_NAMED_IAM --parameter-overrides EnvironmentType=$environmentType ProjectResourcePrefix=$projectResourcePrefix AWSManagementAccountNumber=$AWSManagementAccountNumber
```

#### 3.3.5 Get Copy of KMS Key Arn just created <!-- omit in toc -->
This command will store a local variable of the KMS Key Arn created in previous step
1. Query CloudFormation Stack for KMS Key Arn
```
get_cmk_command="aws cloudformation describe-stacks --stack-name "${projectResourcePrefix}-setup-artif-${environmentType}" --profile $profileDeploymentAccount --region $awsregion --query \"Stacks[0].Outputs[?OutputKey=='CodePipelineKMSKeyArn'].OutputValue\" --output text"
CodePipelineKMSKeyArn=$(eval $get_cmk_command)
printf "Got CMK ARN: $CodePipelineKMSKeyArn"
```

#### 3.3.6 Setup IAM Roles for CodePipeline to access DEPLOYMENT Account <!-- omit in toc -->
1. Compile the CloudFormation script
```
aws cloudformation package --template-file ./cf/setup/03_iam_role_codepipeline.yaml --output-template-file "./.build/_03_iam_role_codepipeline.yaml" --s3-bucket NOTUSED --profile $profileDeploymentAccount
```

2. Deploy the CloudFormation script
```
aws cloudformation deploy --template-file "./.build/_03_iam_role_codepipeline.yaml" --stack-name "${projectResourcePrefix}-setup-cp-roles-${environmentType}" --profile $profileDeploymentAccount --region $awsregion --capabilities CAPABILITY_NAMED_IAM --parameter-overrides EnvironmentType=$environmentType AWSDeploymentAccountNumber=$AWSDeploymentAccountNumber KMSKeyArn=$CodePipelineKMSKeyArn ProjectResourcePrefix=$projectResourcePrefix RepoPrefix=$repoPrefix
```

#### 3.3.7 Deploy IAM Roles and KMS Trust with TARGET Account <!-- omit in toc -->
1. Compile the CloudFormation script
```
aws cloudformation package --template-file ./cf/setup/04_target_deploy_roles.yaml --output-template-file "./.build/_04_target_deploy_roles.yaml" --s3-bucket NOTUSED --profile $profileManagementAccount
```

2. Deploy the CloudFormation script
```
aws cloudformation deploy --template-file "./.build/_04_target_deploy_roles.yaml" --stack-name "${projectResourcePrefix}-setup-deployroles-${environmentType}" --profile $profileManagementAccount --region $awsregion --capabilities CAPABILITY_NAMED_IAM --parameter-overrides EnvironmentType=$environmentType AWSDeploymentAccountNumber=$AWSDeploymentAccountNumber KMSKeyArn=$CodePipelineKMSKeyArn ProjectResourcePrefix=$projectResourcePrefix
```

# 3.3.8 Deploy StackSet Managed Self-service Roles to MANAGEMENT Account <!-- omit in toc -->
1. Compile the CloudFormation script
```
aws cloudformation package --template-file ./cf/setup/04_target_deploy_roles.yaml --output-template-file "./.build/_04_target_deploy_roles.yaml" --s3-bucket NOTUSED --profile $profileManagementAccount
```
2. Deploy the CloudFormation script
```
aws cloudformation deploy --template-file "./.build/_04_target_deploy_roles.yaml" --stack-name "${projectResourcePrefix}-setup-deployroles-${environmentType}" --profile $profileManagementAccount --region $awsregion --capabilities CAPABILITY_NAMED_IAM --parameter-overrides EnvironmentType=$environmentType AWSDeploymentAccountNumber=$AWSDeploymentAccountNumber KMSKeyArn=$CodePipelineKMSKeyArn ProjectResourcePrefix=$projectResourcePrefix
```

# 3.3.9 Setup DynamoDB tables used for Config Management to DEPLOYMENT Account <!-- omit in toc -->
1. Compile the CloudFormation script
```
aws cloudformation package --template-file ./cf/setup/06_dynamo_db.yaml --output-template-file "./.build/_06_dynamo_db.yaml" --s3-bucket NOTUSED --profile $profileDeploymentAccount
```
2. Deploy the CloudFormation script
```
aws cloudformation deploy --template-file "./.build/_06_dynamo_db.yaml" --stack-name "${projectResourcePrefix}-setup-dyndb" --profile $profileDeploymentAccount --region $awsregion --capabilities CAPABILITY_NAMED_IAM --parameter-overrides ProjectResourcePrefix=$projectResourcePrefix
```

#### 3.3.9 Compile Lambda Extension for Slack/MS Teams Add-on [OPTIONAL] <!-- omit in toc -->
1. Install node-lambda (if not already done)
```
npm install node-lambda -g
```

2. Run following script in bash
```
./cf/cicd/build_lambdas.sh
```

#### 3.3.10 Setup RDK Lambda Role and rdk deploy bucket in DEPLOYMENT account <!-- omit in toc -->
1. Compile the CloudFormation script
```
aws cloudformation package --template-file ./cf/setup/07_setup_RDK_role_and_deploy_bucket.yaml --output-template-file "./.build/07_setup_RDK_role_and_deploy_bucket.yaml" --s3-bucket NOTUSED --profile $profileDeploymentAccount
```
2. Deploy the CloudFormation script
```
aws cloudformation deploy --template-file "./.build/07_setup_RDK_role_and_deploy_bucket.yaml" --stack-name "${projectResourcePrefix}-setup-rdk" --profile $profileDeploymentAccount --region $awsregion --capabilities CAPABILITY_NAMED_IAM --parameter-overrides ProjectResourcePrefix=$projectResourcePrefix
```

#### 3.3.11 Setup CI/CD Infrastructure Pipeline (CodePipeline) to DEPLOYMENT account <!-- omit in toc -->
1. Compile the CloudFormation script
```
sam package --template-file ./cf/cicd/stackset_pipeline.yaml --output-template-file "./.build/_stackset_pipeline.yaml" --s3-bucket $s3ArtifactsBucket --profile $profileDeploymentAccount --region $awsregion
```

2. Deploy the CloudFormation script
```
sam deploy --template-file "./.build/_stackset_pipeline.yaml" --stack-name "${projectResourcePrefix}-pipeline-${environmentType}" --profile $profileDeploymentAccount --region $awsregion --capabilities CAPABILITY_NAMED_IAM --parameter-overrides EnvironmentType=$environmentType RepoName=$codeCommitRepoName BranchName=$codeCommitBranchName AWSManagementAccountNumber=$AWSManagementAccountNumber RepoAccountNumber=$AWSDeploymentAccountNumber ProjectResourcePrefix=$projectResourcePrefix EmailFailedBuildNotifications=$emailFailedBuildNotifications EmailApprovalNotifications=$emailApprovalNotifications
```
