# AWS DevSecOps CI/CD Framework for AWS Organisations

This project is a framework for delivering governed DevSecOps CloudFormation Stacks across AWS Accounts in an AWS Organisations/AWS Control Tower account setup.

- [AWS DevSecOps CI/CD Framework for AWS Organisations](#aws-devsecops-cicd-framework-for-aws-organisations)
	- [1. About](#1-about)
	- [2. Prerequisite Setup:](#2-prerequisite-setup)
	- [3. Initial Setup (Once-off) - Setting up Orchestration](#3-initial-setup-once-off---setting-up-orchestration)
		- [3.1. Setup your configuration variables](#31-setup-your-configuration-variables)
			- [Optional Settings for Group Chat Integration (Slack or MS Teams)](#optional-settings-for-group-chat-integration-slack-or-ms-teams)
		- [3.2 AUTOMATED DEPLOYMENT](#32-automated-deployment)
			- [3.2.1 Simple Install (no Slack or MS Teams Integration)](#321-simple-install-no-slack-or-ms-teams-integration)
			- [3.2.2 Advanced Install with Slack Integration](#322-advanced-install-with-slack-integration)
			- [3.2.3 Advanced Install with MS Teams Integration](#323-advanced-install-with-ms-teams-integration)
		- [3.3 MANUAL DEPLOYMENT](#33-manual-deployment)
		- [3.4 Setup Source Control](#34-setup-source-control)
	- [4. Using the AWS DevSecOps CI/CD Framework](#4-using-the-aws-devsecops-cicd-framework)
		- [4.1 How it works](#41-how-it-works)
		- [4.2 Creating your own DevSevOps Stacks and StackSets](#42-creating-your-own-devsevops-stacks-and-stacksets)
	- [5. Todos](#5-todos)
	- [6. Contact](#6-contact)

## 1. About
This solution is an easy way to make DevSecOps changes to accounts with governed workflow to allow testing environments and approval steps before deployment to 'production' accounts. By creating your own StackSets you granularly deploy to given environments unique resources or controls such as VPCs, VPC Endpoints, Roles, Policies, etc.

The solution deploys DevSecOps code as CloudFormation StackSets in the 'Management Account' which then deploy Stack Instances to specified TEST and PROD AWS Organisation OrgUnitIds (or specified accounts).

The solution is documented in the following blog post:
https://www.linkedin.com/pulse/automating-your-devsecops-aws-damien-coyle

**-- Reference Architecture --**

![DevSecOps CICD Reference Architecture](http://devsecops-cicd-public-assets.s3-website-ap-southeast-2.amazonaws.com/examples/devsecops_cicd_reference_architecture.png)

More information on how to use the framework is available in section 4.


## 2. Prerequisite Setup:
### 2.2 AWS Deployment will require the following CLI on your PC <!-- omit in toc -->
1. NodeJS [https://nodejs.org/en/]
2. AWS CLI [https://aws.amazon.com/cli/]
3. AWS SAM CLI [https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/serverless-sam-cli-install.html]
### 2.3 Setup temp build folder on your local env <!-- omit in toc -->
Create a local build folder (using Bash Terminal) where build outputs will be produced
```
mkdir .build
```
### 2.4 Setup your AWS Profiles on your local env <!-- omit in toc -->
Setup your AWS profiles. Start by running:
```
aws configure
```
This step is mostly just to create a 'config' and 'credentials' text file located:
C:\Users\MYUSER\.aws    (assume your running this in Windows)
set your default region in the 'config' file

If you are using AWS Control Tower and AWS SSO, its likely you will overright content of the 'credentials' file with those from the AWS SSO launch page with new profile alias'.

This project assumes the following AWS profiles setup on your machine:

- [org-deployment] - the AWS Account to host the Code Repo (CodeCommit) and CICD components (CodePipeline, CodeBuild)
- [org-management] - the parent AWS Account that hosts AWS Organisations/AWS Control Tower 

### 2.5 Setup your AWS Organisations management account for enabling StackSets <!-- omit in toc -->
1. In 'AWS Organizations' - Enable Service CloudFormation StackSets.
In your management aws account you will need to enable the Service 'CloudFormation StackSets' (if you havent already) in order to deploy StackSets across your organization.
   - 1. In the AWS Console, navigate to AWS Organizations >> Services >> CloudFormation StackSets, click 'Enable trusted access'
   - 2. Navigate to CloudFormation >> StackSets >> 'Enable Trusted Access'


## 3. Initial Setup (Once-off) - Setting up Orchestration
### 3.1. Setup your configuration variables
Perform 'Replace in Files' on all the following variables across the project code to setup scripts for your environment (including this readme!).

Go through each item in this table and find and replace all 'Placeholder to find' items with your own variables suitable to your environment.

|       Placeholder to find        |        Value Format         |          Example Value          |                                     Description                                     |
| :------------------------------: | :-------------------------: | :-----------------------------: | :---------------------------------------------------------------------------------: |
|      PROJECT-FRIENDLY-NAME       |   Alphanumeric and space    |      My DevSecOps Project       |                      Friendly name used for Tagging resources                       |
|     PROJECT-RESOURCE-PREFIX      |         (a-zA-z0-9)         |       mycompany-devsecops       | A short prefix to prepend all resources - suggested use a company/dept abbreviation |
|  AWSACCNUMBER-DEPLOYMENTACCOUNT  | 12-digit AWS Account Number |          123456789012           |              The AWS Account designated for CI/CD and CodeCommit Repo               |
|  AWSACCNUMBER-MANAGEMENTACCOUNT  | 12-digit AWS Account Number |          123456789012           |        The parent AWS Account that hosts AWS Organisations/AWS Control Tower        |
|  PROFILE-ORG-DEPLOYMENTACCOUNT   |      AWS Profile name       |         org-deployment          |                     Local AWS Profile of AWS Deployment Account                     |
|  PROFILE-ORG-MANAGEMENTACCOUNT   |      AWS Profile name       |         org-management          |                     Local AWS Profile of AWS Management Account                     |
|      EMAIL-ADDR-FAILEDBUILD      |     valid email address     | pipeline-failed@mydomain.com.au |               Email address where to send Failed CICD Pipeline Builds               |
| EMAIL-ADDR-APPROVALNOTIFICATIONS |     valid email address     | deployapprovals@mydomain.com.au |               Email address where to send Failed CICD Pipeline Builds               |
|            AWS-REGION            |    valid AWS Region Code    |         ap-southeast-2          |      AWS Region for DEPLOYMENT resources (CodeCommit, CodePipeline, CodeBuild)      |


#### Optional Settings for Group Chat Integration (Slack or MS Teams)

| Placeholder to find | Value Format |                                Example Value                                |        Description        |
| :-----------------: | :----------: | :-------------------------------------------------------------------------: | :-----------------------: |
|   MSTEAMSHOSTNAME   |    string    |                         mydomain.webhook.office.com                         | Office 365 webhook domain |
| MSTEAMSWEBHOOKPATH  |    string    | "/webhookb2/XXXX-XXX-XX-XXX-XXXX/IncomingWebhook/XXXXXX/XXX-XXX-XXX-XX-XXX" |  MS Teams Web Hook Path   |
|  SLACKCHANNELNAME   |    string    |                               #myChannelName                                |    Slack Channel Name     |
|  SLACKWEBHOOKPATH   |    string    |                         "/services/XXX/XXXXX/XXXXX"                         |    Slack Web Hook Path    |


Once your have replaced all variables above, then either run the Automated Deployment Script below (#3.2) [recommended], or perform manual deployment (#3.3).

### 3.2 AUTOMATED DEPLOYMENT  
#### 3.2.1 Simple Install (no Slack or MS Teams Integration) 
To deploy the framework automatically, after performing Replace in Files (3.1) above, run the following script:
```
./cf/setup/automated_deployment.sh
```
#### 3.2.2 Advanced Install with Slack Integration
You can optionally install this solution to post CodePipeline notifications to a Slack Channel.  

**-- Slack Channel Pipeline Notifications Screenshot --**

![DevSecOps Slack Integration](http://devsecops-cicd-public-assets.s3-website-ap-southeast-2.amazonaws.com/examples/slack_example.png)

1. Create a Slack App
   1. Navigate to https://api.slack.com/apps?new_app=1
   2. Create New App >> From Scratch. 
   3. Input a App Name and select suitable Workspace >> Create App
   4. Select features 'Incoming Webhooks' >> Turn feature to 'On'
   5. Click 'Add New Webhook to Workspace' >> select your channel and 'Allow'
   6. Copy the Webhook Url. Strip first part of url, keep from '/services/..'

2. To deploy the framework automatically, after performing Replace in Files (3.1) above, run the following script
```
./cf/setup/automated_deployment.sh --i "slack" -c "SLACKCHANNELNAME" -d "SLACKWEBHOOKPATH"
```
#### 3.2.3 Advanced Install with MS Teams Integration
You can optionally install this solution to post CodePipeline notifications to a MS Teams Channel.  

**-- MS Teams Channel Pipeline Notifications Screenshot --**

![DevSecOps MS Teams Integration](http://devsecops-cicd-public-assets.s3-website-ap-southeast-2.amazonaws.com/examples/msteam_example.png)

1. Create an Incoming Webhook Connector in your Channel
	1. Navigate to the channel you want pipeline notifications to appear
	2. Select 'Connectors' from the channel options menu
	3. In 'Search' find 'Incoming Webhook'
	4. Input a name, image and 'Create'
	5. Copy the URL, split the url by the hostname and path for next step.

2. To deploy the framework automatically, after performing Replace in Files (3.1) above, run the following script
```
./cf/setup/automated_deployment.sh --i "msteams" -e "MSTEAMSHOSTNAME" -f "MSTEAMSWEBHOOKPATH"
```
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
msTeamsHostName="MSTEAMSHOSTNAME"
msTeamsWebHookPath="MSTEAMSWEBHOOKPATH"
slackChannelName="SLACKCHANNELNAME"
slackWebHookPath="SLACKWEBHOOKPATH"
printf "Done"

```

#### 3.3.2 Upload Slack/MS Teams Settings to AWS Secrets in DEPLOYMENT account [OPTIONAL] <!-- omit in toc -->
1. Create local variables to be used as Secret Values.
   * **[For Slack Integration]**
		Assuming you have performed (step 3.2.2.1 above) and replace script placeholders (3.1)
	```
	secretName="SlackSettings"
	secretValue="{\"slackChannelName\":\"${slackChannelName}\",\"slackWebHookPath\":\"${SLACKWEBHOOKPATH}\"}"
	```
	* **[MS Teams Integration]**
Assuming you have performed (step 3.2.2.1 above) and replace script placeholders (3.1)
	```
	secretName="MSTeamsSettings"
	secretValue="{\"msTeamsHostname\":\"${msTeamsHostName}\",\"msTeamsWebHookPath\":\"${MSTEAMSWEBHOOKPATH}\"}"
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

#### 3.3.8 Compile Lambda Extension for Slack/MS Teams Add-on [OPTIONAL] <!-- omit in toc -->
1. Install node-lambda (if not already done)
```
npm install node-lambda -g
```

2. Run following script in bash
```
./cf/cicd/build_lambdas.sh
```

#### 3.3.9 Setup CI/CD Infrastructure Pipeline (CodePipeline) to DEPLOYMENT account <!-- omit in toc -->
1. Compile the CloudFormation script
```
sam package --template-file ./cf/cicd/stackset_pipeline.yaml --output-template-file "./.build/_stackset_pipeline.yaml" --s3-bucket $s3ArtifactsBucket --profile $profileDeploymentAccount --region $awsregion
```

2. Deploy the CloudFormation script
```
sam deploy --template-file "./.build/_stackset_pipeline.yaml" --stack-name "${projectResourcePrefix}-pipeline-${environmentType}" --profile $profileDeploymentAccount --region $awsregion --capabilities CAPABILITY_NAMED_IAM --parameter-overrides EnvironmentType=$environmentType RepoName=$codeCommitRepoName BranchName=$codeCommitBranchName AWSManagementAccountNumber=$AWSManagementAccountNumber RepoAccountNumber=$AWSDeploymentAccountNumber ProjectResourcePrefix=$projectResourcePrefix EmailFailedBuildNotifications=$emailFailedBuildNotifications EmailApprovalNotifications=$emailApprovalNotifications
```

### 3.4 Setup Source Control
#### 3.4.1 Create IAM User to access new CodeCommit Repo (if not already setup) <!-- omit in toc -->

1. Create an IAM User in the CODE account, put user in a new group 'CodeCommitUser', give the user the Managed Policy 'AWSCodeCommitPowerUser'.

2. Navigate to the IAM Users you just created, go to the Security credentials tab, scroll to bottom of page. In 'HTTPS Git credentials for AWS CodeCommit' section, click 'Generate credentials' and the 'Download credentials'

#### 3.4.2 Connect to new GIT repo, copy code to LOCAL repo, Make initial COMMIT & PUSH <!-- omit in toc -->
Before you can run the Pipeline, you will the code-base in the repo you just setup.
1. Create a HTTPS GIT connection to your repo
2. Copy contents of code-base to local folder
3. GIT ADD, GIT COMMIT to local repo all files with comment 'Initial Commit'
4. GIT PUSH to sent to remote repo on designated branch (codeCommitBranchName)


## 4. Using the AWS DevSecOps CI/CD Framework
### 4.1 How it works
The purpose of this project is to take away some of the hassles of setting up CI/CD, and easily deploying stacks across AWS Organizations with some sensible approval workflow.

If you follow the default code it will create the CI/CD workflow, setup a project that allows customisation of each StackSet and the Organisation Units (OU) where Stack Instances will be deployed to for both TEST and PROD environments. It will also optionally setup Slack or MS Teams Integration to post CI/CD success, failure and approval steps to a specified channel.

When you commit and push code in the CodeCommit repository, the CodePipeline  builds the CloudFormation templates and associated code using a CodeBuild step in the designated AWS DEPLOYMENT account. The pipeline them deploys the CloudFormation Master Stack into the MANAGEMENT account, installing all StackSets sandboxed with unique names as either TEST or PROD. This helps prevent accidental deployment of a Stack Instance to the wrong environment.

Finally Stack Instances from either the TEST or PROD StackSets are then created based on the '/cf/project/parameters' deployment settings. 

The overall workflow of the Pipeline is:
1. Build Artifacts
2. Deploy TEST StackSets to MANAGEMENT ACCOUNT
3. Deploy TEST Stack Instances to designated OrgUnitIds
4. Sent Manual Approval Email (or optional MS Teams/Slack notification)
5. [if approval recieved] 
   1. Deploy PROD StackSets to MANAGEMENT ACCOUNT
   2. Deploy PROD Stack Instances to designated OrgUnitIds
  
The first part of the CI/CD will deploy code to the 'test.json' location/settings. Once deployed a 'Manual Approval' email (and MS Teams/Slack notification) will be sent. Once approval has been accepted, it will deploy the same compiled code using the production settings as specified in 'prod.json'.

> The sample stack the solution comes with demonstrates setting up a simple S3 Bucket to target TEST and PROD OU's centrally from the AWS MANAGEMENT account, as compiled and deployed from the DEPLOYMENT account. Replace this sample with your own stacks and resources.

### 4.2 Creating your own DevSevOps Stacks and StackSets
To create you own Stacks and associated StackSet simply duplicate the folder '/cf/project/nested-stacks/_template'. Rename the folder, stack and stackset to reflect the group of resources you are trying to create. 

For example, if you wanted to standardise VPC Endpoints across accounts you might setup the following:
- cf
	- project
		- nested-stacks
			- vpc-endpoints
				- VPCEndPointStack.yaml
				- VPCEndPointStackSet.yaml

Create your resources (in this example VPC Endpoints) in the 'VPCEndPointStack.yaml'
Modify 'VPCEndPointStackSet.yaml' (derrived from 'XStackSet.yaml'):
- Modify the Resource Name (Line 39): XStackSet to a friendly name, say 'VPCEndPointStackSet'
- Replace the TemplateURL file name (Line 43) with the name of the Stack.
i.e. instead of 'XStack_output.yaml' set to 'VPCEndPointStack_output.yaml'

	> Note: the build process automatically prepends '_output.yaml' to files copied to S3. This has been done as the compiled CloudFormation may differ from your template. Only modify the name part of the file when referring to the S3 Path in either the MasterStack or StackSet files.

Hook up your new Stack and StackSet to the Master Stack by adding a new *'AWS::CloudFormation::Stack'* in */cf/project/MasterStack.yaml*. Use the 'SampleStackSetS3' resource as a guide. Here you can also hook up any custom parameters your stack might need. Any additional CloudFront parameters also need to be added to your *'/cf/project/parameters'* 'test.json' and 'prod.json' files.  

## 5. Todos

Things I would like to extend on this framework:
- [ ] Have a separate 'simple' CI/CD for DEV environment (with no Approval)
- [ ] Allow deployment of single AWS Accounts (instead of OrgUnitIds)
- [ ] Allow parameter file to specify OU names instead of Ids

## 6. Contact

**Damien Coyle**  
Princial Technologist  
AWS APN Ambassador  
[Comunet Pty Ltd](https://www.comunet.com.au)

Connect on [linkedin](https://www.linkedin.com/in/damiencoyle/)