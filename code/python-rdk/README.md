# Rules Development Kit (RDK) Project

This file details the structure of the associated Rules Development Kit (RDK) rules for AWS Config.  It covers the basics of the RDK and how it interacts with the more complete DevSecOps stack.

- [Rules Development Kit (RDK) Project](#rules-development-kit-rdk-project)
  - [1. About](#1-about)
    - [1.1 Environment Overview](#11-environment-overview)
  - [2. Creating a new rule](#2-creating-a-new-rule)
    - [2.1 Setup of your environment](#21-setup-of-your-environment)
    - [2.2 Creating a new empty rule](#22-creating-a-new-empty-rule)
    - [2.3 Define the conditioners you are intending to implement for](#23-define-the-conditioners-you-are-intending-to-implement-for)
    - [2.4 Setup test cases](#24-setup-test-cases)
    - [2.5 Implement functionality](#25-implement-functionality)
    - [2.6 Test in a development account](#26-test-in-a-development-account)
    - [2.7 Include in automated deployment and setup parameters](#27-include-in-automated-deployment-and-setup-parameters)
  - [3. Modifying an existing Rule](#3-modifying-an-existing-rule)
  - [4. Example Rule](#4-example-rule)
  - [Appendix A. References](#appendix-a-references)
  - [Acknowledgements](#acknowledgements)

## 1. About
The RDK is a framework provided by AWS to allow for the rapid building of custom AWS Config rules, along with associated tooling to allow these to be easily tested and deployed.  Use this folder (/code/python-rdk/) to place your custom RDK rules to enforce best practice across your AWS accounts.

Currently when new rules are created in this folder - and configured correctly (see below) - they will be automatically rolled out to all accounts across the AWS Organization.

For reference custom AWS Config Rules consist of 2 parts, a backend Lambda function to perform the checks - and report on associated compliance - and the actual AWS Config rule which triggers the target account AND region.  

### 1.1 Environment Overview
In implementing RDK for the DevSecOps framework, the aim is to deploy custom AWS Config rules globally, but minimise the footprint for management of the custom Lambda code.

To this end the custom RDK rules are deployed in 2 components:
1. The backend Lambda functions are deployed to a central account (in this case the DEPLOYMENT account)
2. The AWS Config rules are then deployed to all target accounts/regions with permissions to execute the central lambda functions on the target accounts

More details on how this structure is achieved can be found in the section describing the DevSecOps pipeline.

## 2. Creating a new rule
### 2.1 Setup of your environment
In order to prepare your environment - and your associated AWS development account for building and testing RDK it is suggested you follow the following steps:
1. Setup your default credetials for the AWS CLI in your environment
2. Install the AWS RDK - outlined in https://github.com/awslabs/aws-config-rdk
3. Create a new Lambda role in your development environment - this role should include the basic lambda execution policy and a custom policy to assume *
4. Run the `rdk init` command to ensure that AWS config is running in your test environment - this will use the default credentials outlined above. This will ensure that Config is running and setup a deployment bucket for Lambda functions
5. If AWS Config is not using a custom role then setup a new role and configure Config to use this - ensure that the new role has the ReadOnly access policy
6. Extend the custom Config role to trust the Lambda defined above

### 2.2 Creating a new empty rule
The RDK provides a method of scaffolding rules via the command line interface.
1. Change into the python-rdk directory
2. Run the command `rdk create RULENAMEHERE --runtime python3.8 --maximum-frequency TwentyFour_Hours`

The above will create a new rule using the Python language (all the automated build and deployment steps later are build around this), that is preconfigured to run every 24 hours when deployed.  It is possible to generate a rule that is triggered off changes in environment instead.

### 2.3 Define the conditioners you are intending to implement for
It is suggested that you create a rules.txt in the base of your new rule to define the specific criteria you are implementing for.  Examples of these can be seen in the existing rules, or below.

> Desired Rules
> - If rds security group inbound rules have unrestricted IPv4s (0.0.0.0/0) then it is not complient

This makes it clear to both you as the developer and any other uses who will need to support this in the future the extent to which the implemented rule will impact the environment.

### 2.4 Setup test cases
The RDK scaffolding process provides 2 files when it creates the new rule template, a base file into which functionality should be implemented (named the same as the rule) and a test file to implement unit tests.  You will need to implement a test case for every one of the rules you defined in the rules.txt above.

This will allow for local testing of your logic and the validation that your code will function when put into the test environment.  It also allows for validating a large number of specific test cases that would otherwise be infeasible to manually setup (IAM least priviledge permissions are the most obvious case for this).

Examples can be found in the existing rules - the test cases themselves use the existing Python MagicMock framework.

You can then run your test cases by running the command:

`rdk test-local RULENAMEHERE`

This will run the tests and report pass/fail status.

### 2.5 Implement functionality
As mentioned in the previous step the implementation of the rules is done in the scaffolded file, prior to beginning to implement code there are several changes you will need to make first:
* Update the `DEFAULT_RESOURCE_TYPE` setting to match that which will be returned by your rule
* Update `ASSUME_ROLE_MODE` to True - this is what is used to assume the role in the cross account scenario

When implementing the functionality for the rules there are several items that are important to note:
* When you are generating the BOTO3 client to connection to the AWS SDK you need to use the `get_client` function - this will correctly assume the cross account role when you deploy into the live environments
* When checking for IAM least privileges there is an existing helper class you can use AWSConfigIAMProcessor which already has the logic to get all the policies that are associated with roles and users - this means that you only need to modify the logic which checks these to implement new IAM Least Privilege checks
* If there is a need for parameters - at a minimum you will likely need to be able to whitelist specific names - you can add these in the parameters.json file, as seen in the existing rules

### 2.6 Test in a development account
> Prior to testing in development please ensure that all test cases pass

In order to test in your development account (assumed to be the default account setup for your AWS CLI) you can run the deployment command below:

`rdk deploy RULENAMEHERE --lambda-timeout 600 --lambda-role-arn DEVLAMBDAROLEARNHERE`

The above command will setup a CloudFormation stack for the noted rule and deploy it using the associated rule - the lambda role is defined so that you do not need to individually trust every Lambda role that RDK creates for testing.

In order to run the role:
1. Login to the AWS Console for you account
2. Navigate to Config
3. Open the rule
4. Hit Evaluate

The above will then either run and report back a list of compliant/non compliant devices (and set the Last Executed Time) or will not run.

Common issues are:
* You did not wait long enough - if you have an IAM Least Privilege rule then this can take several minutes to run
* The trust relationship is not setup between Config and your Lambda
* The custom Config role does not access to the specific read permission for what is being checked

You can find the Cloudwatch logs for the Lambda function as you would any other to investigate further.

### 2.7 Include in automated deployment and setup parameters
To include the newly created rule in the deployment process you need to add the following to the parameters.json under the `Parameters` object
```
    "RuleSets": [
      "all-rules-test",
      "all-rules-prod"
    ]
```
- Adding 'all-rules-test' will deploy the rule to either the default 'test' deployment group (`/config/GlobalParams.json`) or the override designated OU in `/config/Stacks.json` for the stack `CustomRDKAWSConfigRulesStackSet` where environmentType="test"
- Adding 'all-rules-prod' will deploy the rule to either the default 'prod' deployment group (/config/GlobalParams.json) or the override designated OU as defined in `/config/Stacks.json` for the stack `CustomRDKAWSConfigRulesStackSet` where environmentType="prod"

This allows you to selectively work on rules in a test environment prior to sending to a production environment regardless of whether the pipeline deploys to prod or not.

To ensure that any parameters you setup are propagated as a part of this you will need to:
1. Add the new settings to the `/config/Stacks.json` file `CustomRDKAWSConfigRulesStackSet` section - the names should match the names in the generated CloudFormation template, you can use the deployment command above along with the flag `--rules-only` to see the generated parameter name

## 3. Modifying an existing Rule
To modify an existing rule your should:
1. Update the `rules.txt` to reflect the changes you are making the enforced rules
2. Update the unit tests to check any code changes
3. Test in the local environment first prior to including in the full CICD process - note that you can remove the RuleSet from the rule temporarily to stop it being enforced, although this will remove the rule globally


## 4. Example Rule
The DevSecOps Framework comes with an example rule `AWSConfigRuleKMSLeastPrivilege`. This sample rule is supplied by `aws-samples` has been developed by Tracy Pierce [https://github.com/aws-samples/aws-config-aws-kms-policy-rule] and is explained in the post [https://aws.amazon.com/blogs/security/how-to-use-aws-config-to-determine-compliance-of-aws-kms-key-policies-to-your-specifications/]. 
This rule code is made available under a modified MIT license.

## Appendix A. References
Documentation for the RDK commands https://github.com/awslabs/aws-config-rdk/blob/master/docs/reference/

## Acknowledgements
- Tracy Piece - example RDK rule `AWSConfigRuleKMSLeastPrivilege` [https://github.com/aws-samples/aws-config-aws-kms-policy-rule]