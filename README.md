# AWS DevSecOps CI/CD Framework for AWS Organizations (v3)

This project is a framework for delivering governed DevSecOps CloudFormation Stacks across AWS Accounts allowing you to target specific targeted Regions and Organizational Units (OUs) per stack. This solution is suitable for any organisation which uses a AWS Organisations/AWS Control Tower account setup.

- [AWS DevSecOps CI/CD Framework for AWS Organizations (v3)](#aws-devsecops-cicd-framework-for-aws-organizations-v3)
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
		- [4.2 Configuring DevSecOps Framework - Global Settings, Deployment Groups, Org Units and Stacks](#42-configuring-devsecops-framework---global-settings-deployment-groups-org-units-and-stacks)
			- [4.2.1 GlobalParams.json](#421-globalparamsjson)
			- [4.2.3 OrgUnits.json](#423-orgunitsjson)
			- [4.2.3 Stacks.json](#423-stacksjson)
		- [4.2 Creating your own DevSevOps Stacks and StackSets](#42-creating-your-own-devsevops-stacks-and-stacksets)
		- [4.3 AWS Config Custom Rules with the Rule Development Kit (RDK)](#43-aws-config-custom-rules-with-the-rule-development-kit-rdk)
	- [5. Testing Locally](#5-testing-locally)
		- [5.1 AWS CDK](#51-aws-cdk)
		- [5.2 DynamoDB Config Updates](#52-dynamodb-config-updates)
	- [7. Todos](#7-todos)
	- [8. Contact](#8-contact)

## 1. About
This solution is an easy way to make DevSecOps changes to accounts with governed workflow to allow testing environments and approval steps before deployment to 'production' accounts. By creating your own StackSets you granularly deploy to given environments unique resources or controls such as VPCs, VPC Endpoints, Roles, Policies, etc.

The solution deploys DevSecOps code as CloudFormation StackSets in the 'Management Account' which then deploy Stack Instances to specified TEST and PROD AWS Organisation OrgUnitIds in specified regions.

The solution is further documented in the following blog post:
https://www.linkedin.com/pulse/automating-your-devsecops-aws-damien-coyle

**-- Reference Architecture --**

![DevSecOps CICD Reference Architecture](http://devsecops-cicd-public-assets.s3-website-ap-southeast-2.amazonaws.com/examples/devsecops_cicd_reference_architecture.png)

More information on how to use the framework is available in section 4.



## 2. Prerequisite Setup:
### 2.2 AWS Deployment will require the following CLI on your PC <!-- omit in toc -->
1. NodeJS [https://nodejs.org/en/]
2. AWS CLI [https://aws.amazon.com/cli/]
3. AWS SAM CLI [https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/serverless-sam-cli-install.html]
4. AWS CDK [https://docs.aws.amazon.com/cdk/latest/guide/home.html]

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
|  MSTEAMS-HOSTNAME   |    string    |                         mydomain.webhook.office.com                         | Office 365 webhook domain |
| MSTEAMS-WEBHOOKPATH |    string    | "/webhookb2/XXXX-XXX-XX-XXX-XXXX/IncomingWebhook/XXXXXX/XXX-XXX-XXX-XX-XXX" |  MS Teams Web Hook Path   |
|  SLACK-CHANNELNAME  |    string    |                               #myChannelName                                |    Slack Channel Name     |
|  SLACK-WEBHOOKPATH  |    string    |                         "/services/XXX/XXXXX/XXXXX"                         |    Slack Web Hook Path    |

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
./cf/setup/automated_deployment.sh --i "slack" -c "SLACK-CHANNELNAME" -d "SLACK-WEBHOOKPATH"
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
./cf/setup/automated_deployment.sh --i "msteams" -e "MSTEAMS-HOSTNAME" -f "MSTEAMS-WEBHOOKPATH"
```
### 3.3 MANUAL DEPLOYMENT
If you prefer the Manual Deployment, to help with readability steps are outlined in the separate file (/cf/setup/Manual_Deployment.md).


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

If you follow the default code it will create the CI/CD workflow and prerequisite resources for cross-account deployment, and setup a AWS CDK project which dynamically generates a set CloudFormation templates each time the CI/CD is triggered as per the unique configuration you provide in the (/config) files.

The automatically generated files setups up a Master/Nested CF stack and automatically generates StackSets pointing to the CF Stacks you want to deploy.

Through simple alterations to (/config) files you can customisation how each Stack us deployed to different Organisation Units (OUs) and AWS Regions through setting up 'Deployment Groups'. You can also specify a set of test OUs where you can test your DevSecOps code prior to deploying to productions environments. 

Finally you can also optionally setup Slack or MS Teams Integration to post CI/CD success, failure and approval steps to a specified channel.

When you commit and push code in the CodeCommit repository, the CodePipeline builds the CloudFormation templates and associated code using a CodeBuild step in the designated AWS DEPLOYMENT account. It then generates the Master/Nested stacks and StackSets per environment (TEST and PROD) using AWS CDK. The pipeline them deploys the CloudFormation Master Stack into the MANAGEMENT account, installing all StackSets sandboxed with unique names as either TEST or PROD. This helps prevent accidental deployment of a Stack Instance to the wrong environment.

Finally Stack Instances from either the TEST or PROD StackSets are then created based on the '/config/Stacks.json' deployment settings. 

The overall workflow of the Pipeline is:
1. Build Artifacts, Validate Templates, Generated Dynamic Master Stack and StackSet templates via CDK.
2. Deploy TEST StackSets to MANAGEMENT ACCOUNT
3. Deploy TEST Stack Instances to designated OrgUnitIds
4. Sent Manual Approval Email (or optional MS Teams/Slack notification)
5. [if approval recieved] 
   1. Deploy PROD StackSets to MANAGEMENT ACCOUNT
   2. Deploy PROD Stack Instances to designated OrgUnitIds
  
The first part of the CI/CD will deploy code to the (env='test') location/settings. Once deployed a 'Manual Approval' email (and MS Teams/Slack notification) will be sent. Once approval has been accepted, it will deploy the same compiled code using the production settings (env='prod').

> NOTE: The sample stack the solution comes with demonstrates setting up a simple S3 Bucket to target TEST and PROD OU's centrally from the AWS MANAGEMENT account, as compiled and deployed from the DEPLOYMENT account. Replace this sample with your own stacks and resources.


### 4.2 Configuring DevSecOps Framework - Global Settings, Deployment Groups, Org Units and Stacks
All settings that determine WHAT gets deployed, and to which org units/accounts/regions (the WHERE) are found in the (/config) folder. 

The three main files are:
- GlobalParams.json
- OrgUnits.json
- Stacks.json

These are described further in next sections.

These json files get deployed to a series of DynamoDB tables everytime the CI/CD is triggered which the AWS CDK code (./code/ts-cdk) queries to generate the necessary stackset structure.

While not 100% necessary (for AWS CDK at least), by storing the json files in DynamoDB, this allows you to build other solutions (such as Lambda Scripts) that can later access the current DevSecOps deployment settings if necessary.

#### 4.2.1 GlobalParams.json
This file details the key environments (TEST and PROD) and the Parameters that ALL CloudFormation scripts deployed by the DevSecOps framework need to have.

By design, the framework will insist all deployed Templates have the following Global Parameters:
- EnvironmentType
- EnvironmentFriendlyName
- ProjectFriendlyName
- ProjectResourcePrefix
- BuildGuid
  
> These do not need to be referenced within Templates, but they must exist in the Paramaters sections of the linked templateFile.

The second major purpose of [GlobalParams.json] is to define the default Deployment Group of each environment. If a Stack (as specified in Stacks.json) does not contain a specific Deployment Group, then whatever 'groupCode' is set in this file in the 'defaultDeploymentGroup' field will be the Deployment Group Org Units it deploys to.

In the 'DeploymentGroups' section you can specify any number of unique deployment groups under a unique name 'groupCode'. These determine the target Org Units (and associated AWS Accounts) a StackSet can be deployed.

#### 4.2.3 OrgUnits.json
The purpose of this file is to specify which AWS Regions you want a given Org Unit to be deployed in. In very large environments it can be very expensive to deploy DevSecOps code to all regions when only a few regions are used in any given Org Unit. This allows you to target your code to only deploy to specified regions per Org Unit.

Whenever you add a new OrgUnit to your AWS Organization, this file needs to be updated to include this new Org Unit and the regions you want DevSecOps code deployed to this Org Unit.

Within a given OrgUnit, list all regions you will deploying resources in a list of 'deploymentRegions'.

Some StackSets may contain resources that can only be installed once per Account. Specify the `defaultRegion` where you want such global resources deployed. In the `Stacks.json` for the given StackSet specify `overrideDeploymentRegionUseDefaultOnly` to deploy to this `defaultRegion` only.

#### 4.2.3 Stacks.json
[Stacks.json] is where all the magic occurs. You can list new Stacks to be made as a StackSet (type=stackset) to deploy instances to any target Org Unit or as a Stack (type=stack) to simply deploy the stack to the Manaagement Account.

The only difference with StackSets and Stacks is that the AWS CDK code will also include with StackSets the automated deployment properties of a StackSet along with either the default Deployment Group (as specified in GlobalParams.json) or a unique group if you specify the optional 'overrideDeploymentGroup' field.

**Local Parameters**
> You can specify unique parameters for the specific stack in the Local Parameters area. This allows you to set unique parameters for different environments (TEST and PROD) for the specific Stack. These will combine with those Global Parameters listed in (GlobalParams.json).

**Special Fields**
> There are a few special fields you can apply to Stacks in file, many optional. These are described below:

| Field Name                                   | Details                                                                                                                                                |
| :------------------------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------- |
| name                                         | The name to be applied to the stackset or stack                                                                                                        |
| type                                         | Either 'stackset' or 'stack' - determines whether StackSet is registered with auto deploy settings                                                     |
| description                                  | Friendly description applied to the stack                                                                                                              |
| templateFile                                 | Name of the CF Template file as found in (/cf/project) folder of the stack to be deployed.                                                             |
| retainStacksOnAccountRemoval                 | ('stackset only) Override the default setting of whether this stack will be retained or not if Account is removed                                      |
| enabled                                      | [optional] 'true' or 'false' - A quick way to enable or disable a stack from deployment. Default is 'true'                                             |
| dependsOn                                    | [optional] Add a dependancy on this stack to another Stack.                                                                                            |
| env[].overrideDeploymentGroup                | [optional] Specify a different deployment group for this stack env than the GlobalParams.json default                                                  |
| env[].overrideDeploymentRegionUseDefaultOnly | [optional] Specifies that the StackSet will only deploy to the one (1) default region in the account as specified in the OrgUnits.json 'defaultRegion' |
| env[].overrideDeploymentRegions              | [optional] Specify a different region list for this stack env in EVERY OU/account, rather that the OU deployment regions listed in OrgUnits.json       |

### 4.2 Creating your own DevSevOps Stacks and StackSets
To create you own Stacks and associated StackSet simply duplicate the folder `/cf/project/_template`. Rename the folder, stack to reflect the group of resources you are trying to create. 

For example, if you wanted to standardise VPC Endpoints across accounts you might setup the following:
- cf
	- project
		- vpc-endpoints
			- VPCEndPointStack.yaml

Create your resources (in this example VPC Endpoints) in the 'VPCEndPointStack.yaml'.

Now open (/config/Stacks.yaml) and copy an existing stack and paste to make a new Stack in the list.

Update field 'name' and 'description' appropriate to your new Stack.

Update the 'templateName' - in this example set to 'VPCEndPointStack.yaml'.

Add any unique local parameters for the stack in the 'prod' and 'test' environments.

> NOTE: Ensure the template you reference has the Global Parameters listed (EnvironmentType, EnvironmentFriendlyName, ProjectFriendlyName, ProjectResourcePrefix) or it will not work.

Update any other deployment group settings unique to your stack

The AWS CDK code (`/code/ts-cdk`) will automatically generate the structure to deploy this new StackSet/Stack provided the field 'enabled' is not equal 'false'.

### 4.3 AWS Config Custom Rules with the Rule Development Kit (RDK)
The DevSecOps framework now supports the AWS Config RDK to easily author and deploy custom AWS Config rules.

Detailed documentation on using the RDK within this framework has been added to the file:
`/code/python-rdk/README.md`


## 5. Testing Locally
### 5.1 AWS CDK
Provided you have the AWS CDK and Typescript installed locally you can test generated stacks built with this framework by providing the build script a local AWS Profile.

Run the AWS CDK build script from a bash terminal with:
```
./cf/cicd/build_ts_aws_cdk.sh -p [PROFILE-ORG-DEPLOYMENTACCOUNT] -b MyBuildGuid1234 -r [PROJECT-RESOURCE-PREFIX]
```
Outputs from the CDK will be built to the (./.build/cdk) folder for reviewing.

### 5.2 DynamoDB Config Updates
If you want to be able to upload to DynamoDB config changes quickly (without the pipeline) you can run the script locally by providing the build script with a local AWS Profile.

Run the DynamoDB Build script from a bash terminal with:
```
./cf/cicd/build_dynamo.sh -p [PROFILE-ORG-DEPLOYMENTACCOUNT] -r [PROJECT-RESOURCE-PREFIX]
```

## 7. Todos

Things I would like to extend on this framework:
- [ ] Allow config files to specify OU names wherever OrgUnitIds are currently used for ease of reading.

## 8. Contact

**Damien Coyle**  
Princial Technologist  
AWS APN Ambassador  
[Comunet Pty Ltd](https://www.comunet.com.au)

Connect on [linkedin](https://www.linkedin.com/in/damiencoyle/)
