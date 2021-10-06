#!/bin/bash

#set stop on error
set -e
GROUPCHATINTEGRATION="none"               # Group Chat Integration
SLACKCHANNELNAME=""                       # Slack Channel Name
SLACKWEBHOOKPATH=""                       # Slack Web Hook Path
MSTEAMSHOSTNAME=""                        # MS Teams Host Name
MSTEAMSWEBHOOKPATH=""                     # MS Teams Web Hook Path
usage() {           
    echo "options:"
    echo "i     Group Chat Integration - Disabled (-i none), Slack (-i slack), MS Teams (-i msteams)"
    echo "c     Set to the Slack Channel Name CICD will post to"
    echo "d     Set to the Slack Web Hook Path of the Channel"
    echo "e     Set to the MS Teams Host Name"
    echo "f     Set to the MS Teams Web Hook Path of the Channel"
    echo "Usage: $0 [ -i GROUPCHATINTEGRATION ] [ -c SLACKCHANNELNAME ] [ -d SLACKWEBHOOKPATH ] [ -e MSTEAMSHOSTNAME ] [ -f MSTEAMSWEBHOOKPATH ]" 1>&2 
}
exit_abnormal() {                         # Function: Exit with error.
    usage
    exit 1
}
# check whether user had supplied -h or --help . If yes display usage 
if [[ ( $# == "--help") ||  $# == "-h" ]] 
then 
    usage
    exit 0
fi 
#get params
while getopts :i:c:d:e:f:h flag
do
    case "${flag}" in
        i) GROUPCHATINTEGRATION=${OPTARG};;
        c) SLACKCHANNELNAME=${OPTARG};;
        d) SLACKWEBHOOKPATH=${OPTARG};;
        e) MSTEAMSHOSTNAME=${OPTARG};;
        f) MSTEAMSWEBHOOKPATH=${OPTARG};;
    esac
done

if [ "$GROUPCHATINTEGRATION" != "none" ] && [ "$GROUPCHATINTEGRATION" != "slack" ] && [ "$GROUPCHATINTEGRATION" != "msteams" ]; then
    echo "Error: (opt -i) must be either 'none', 'slack' or 'msteams'"
    exit_abnormal
    exit 1
fi

printf "\n[1 of 12] setting variables\n"
AWSDeploymentAccountNumber="AWSACCNUMBER-DEPLOYMENTACCOUNT"
AWSManagementAccountNumber="AWSACCNUMBER-MANAGEMENTACCOUNT"
profileDeploymentAccount="PROFILE-ORG-DEPLOYMENTACCOUNT"
profileManagementAccount="PROFILE-ORG-MANAGEMENTACCOUNT"
projectResourcePrefix="PROJECT-RESOURCE-PREFIX"
projectFriendlyName="PROJECT-FRIENDLY-NAME" 
emailFailedBuildNotifications="EMAIL-ADDR-FAILEDBUILD"
emailApprovalNotifications="EMAIL-ADDR-APPROVALNOTIFICATIONS"
environmentType="main"
awsregion="AWS-REGION"
codeCommitRepoName="${projectResourcePrefix}-repo"
codeCommitBranchName="main"
s3ArtifactsBucket="${projectResourcePrefix}-${environmentType}-artifacts-lambda"

if [ "$GROUPCHATINTEGRATION" == "slack" ] || [ "$GROUPCHATINTEGRATION" == "msteams" ]
then
    printf "\n[2 of 12] creating slack secrets in secrets manager\n"
    if [ "$GROUPCHATINTEGRATION" == "slack" ]
    then
        secretName="SlackSettings"
        secretValue="{\"slackChannelName\":\"${SLACKCHANNELNAME}\",\"slackWebHookPath\":\"${SLACKWEBHOOKPATH}\"}"
    else
        secretName="MSTeamsSettings"
        secretValue="{\"msTeamsHostname\":\"${MSTEAMSHOSTNAME}\",\"msTeamsWebHookPath\":\"${MSTEAMSWEBHOOKPATH}\"}"
    fi
    get_slist_command="aws secretsmanager list-secrets --filter Key=name,Values=${secretName} --profile $profileDeploymentAccount --region $awsregion --query \"SecretList[0].ARN\" --output text"
    secret_arn=$(eval $get_slist_command)
    printf " > aws secrets query result - secret_arn: $secret_arn"
    # If secret_arn doesnt exist, create new secret otherwise update secret.
    if [ "$secret_arn" == "None" ]
    then
        printf "\n > creating new secret\n"
        aws secretsmanager create-secret --name $secretName --secret-string $secretValue --profile $profileDeploymentAccount --region $awsregion
    else
        printf "\n > updating secret values\n"
        aws secretsmanager update-secret --secret-id $secretName --secret-string $secretValue --profile $profileDeploymentAccount --region $awsregion
    fi    
else
    printf "\n[2 of 12] (STEP SKIPPED) no Group Chat integration selected\n"
fi

printf "\n[3 of 12] setup CodeCommit Repo in DEPLOYMENT account\n"
aws cloudformation package --template-file ./cf/setup/01_create_codecommit_repo.yaml --output-template-file ./.build/_01_create_codecommit_repo.yaml --s3-bucket NOTUSED --profile $profileDeploymentAccount
aws cloudformation deploy --template-file ./.build/_01_create_codecommit_repo.yaml --stack-name "${projectResourcePrefix}-setup-codecommit-repo" --profile $profileDeploymentAccount --region $awsregion --capabilities CAPABILITY_NAMED_IAM --parameter-overrides ProjectResourcePrefix=$projectResourcePrefix

printf "\n[4 of 12] deploy the S3 Bucket for Build Artifacts with Policy + KMS Key to DEPLOYMENT Account\n"
aws cloudformation package --template-file ./cf/setup/02_deployment_artifacts_bucket.yaml --output-template-file "./.build/_02_deployment_artifacts_bucket.yaml" --s3-bucket NOTUSED --profile $profileDeploymentAccount
aws cloudformation deploy --template-file "./.build/_02_deployment_artifacts_bucket.yaml" --stack-name "${projectResourcePrefix}-setup-artif-${environmentType}" --profile $profileDeploymentAccount --region $awsregion --capabilities CAPABILITY_NAMED_IAM --parameter-overrides EnvironmentType=$environmentType ProjectResourcePrefix=$projectResourcePrefix AWSManagementAccountNumber=$AWSManagementAccountNumber

printf "\n[5 of 12] get Copy of KMS Key Arn just created\n"
#This command will copy to a local variable the KMS Key Arn for step 3.2
get_cmk_command="aws cloudformation describe-stacks --stack-name "${projectResourcePrefix}-setup-artif-${environmentType}" --profile $profileDeploymentAccount --region $awsregion --query \"Stacks[0].Outputs[?OutputKey=='CodePipelineKMSKeyArn'].OutputValue\" --output text"
CodePipelineKMSKeyArn=$(eval $get_cmk_command)
printf " > got CMK ARN: $CodePipelineKMSKeyArn"


printf "\n[6 of 12] setup IAM Roles for CodePipeline to access DEPLOYMENT account\n"
aws cloudformation package --template-file ./cf/setup/03_iam_role_codepipeline.yaml --output-template-file "./.build/_03_iam_role_codepipeline.yaml" --s3-bucket NOTUSED --profile $profileDeploymentAccount
aws cloudformation deploy --template-file "./.build/_03_iam_role_codepipeline.yaml" --stack-name "${projectResourcePrefix}-setup-cp-roles-${environmentType}" --profile $profileDeploymentAccount --region $awsregion --capabilities CAPABILITY_NAMED_IAM --parameter-overrides EnvironmentType=$environmentType AWSDeploymentAccountNumber=$AWSDeploymentAccountNumber KMSKeyArn=$CodePipelineKMSKeyArn ProjectResourcePrefix=$projectResourcePrefix RepoPrefix=$repoPrefix

printf "\n[7 of 12] deploy IAM Roles and KMS Trust with MANAGEMENT Account\n"
aws cloudformation package --template-file ./cf/setup/04_target_deploy_roles.yaml --output-template-file "./.build/_04_target_deploy_roles.yaml" --s3-bucket NOTUSED --profile $profileManagementAccount
aws cloudformation deploy --template-file "./.build/_04_target_deploy_roles.yaml" --stack-name "${projectResourcePrefix}-setup-deployroles-${environmentType}" --profile $profileManagementAccount --region $awsregion --capabilities CAPABILITY_NAMED_IAM --parameter-overrides EnvironmentType=$environmentType AWSDeploymentAccountNumber=$AWSDeploymentAccountNumber KMSKeyArn=$CodePipelineKMSKeyArn ProjectResourcePrefix=$projectResourcePrefix


printf "\n[8 of 12] deploy StackSet Managed Self-service Roles to MANAGEMENT Account\n"
aws cloudformation package --template-file ./cf/setup/05_orgs_stackset_selfmanaged_roles.yaml --output-template-file "./.build/_05_orgs_stackset_selfmanaged_roles.yaml" --s3-bucket NOTUSED --profile $profileManagementAccount
aws cloudformation deploy --template-file "./.build/_05_orgs_stackset_selfmanaged_roles.yaml" --stack-name "${projectResourcePrefix}-setup-orgmngselfservroles" --profile $profileManagementAccount --region $awsregion --capabilities CAPABILITY_NAMED_IAM --parameter-overrides AWSDeploymentAccountNumber=$AWSDeploymentAccountNumber ProjectResourcePrefix=$projectResourcePrefix


printf "\n[9 of 12] deploy Dynamo DB DevSecOps Configuration Tables to DEPLOYMENT Account\n"
aws cloudformation package --template-file ./cf/setup/06_dynamo_db.yaml --output-template-file "./.build/_06_dynamo_db.yaml" --s3-bucket NOTUSED --profile $profileDeploymentAccount
aws cloudformation deploy --template-file "./.build/_06_dynamo_db.yaml" --stack-name "${projectResourcePrefix}-setup-dyndb" --profile $profileDeploymentAccount --region $awsregion --capabilities CAPABILITY_NAMED_IAM --parameter-overrides ProjectResourcePrefix=$projectResourcePrefix


printf "\n[10 of 12] compile Lambda Extension for Notifications Add-ons (Slack and MS Teams)"
# install node-lambda (if not already done)
npm install node-lambda -g
./cf/cicd/build_lambdas.sh

printf "\n [11 of 12] Setup RDK Lambda Role and rdk deploy bucket in DEPLOYMENT account\n"
aws cloudformation package --template-file ./cf/setup/07_setup_RDK_role_and_deploy_bucket.yaml --output-template-file "./.build/07_setup_RDK_role_and_deploy_bucket.yaml" --s3-bucket NOTUSED --profile $profileDeploymentAccount
aws cloudformation deploy --template-file "./.build/07_setup_RDK_role_and_deploy_bucket.yaml" --stack-name "${projectResourcePrefix}-setup-rdk" --profile $profileDeploymentAccount --region $awsregion --capabilities CAPABILITY_NAMED_IAM --parameter-overrides ProjectResourcePrefix=$projectResourcePrefix


printf "\n[12 of 12] setup CI/CD Infrastructure Pipeline (CodePipeline) to DEPLOYMENT account\n"
sam.cmd package --template-file ./cf/cicd/stackset_pipeline.yaml --output-template-file "./.build/_stackset_pipeline.yaml" --s3-bucket $s3ArtifactsBucket --profile $profileDeploymentAccount --region $awsregion
sam.cmd deploy --template-file "./.build/_stackset_pipeline.yaml" --stack-name "${projectResourcePrefix}-pipeline-${environmentType}" --profile $profileDeploymentAccount --region $awsregion --capabilities CAPABILITY_NAMED_IAM --parameter-overrides EnvironmentType=$environmentType RepoName=$codeCommitRepoName BranchName=$codeCommitBranchName AWSManagementAccountNumber=$AWSManagementAccountNumber RepoAccountNumber=$AWSDeploymentAccountNumber ProjectResourcePrefix=$projectResourcePrefix EmailFailedBuildNotifications=$emailFailedBuildNotifications EmailApprovalNotifications=$emailApprovalNotifications GroupChatIntegration=$GROUPCHATINTEGRATION

printf "\n**Deployment complete!**\n\nNext Steps: now setup your local GIT repo, via a CLONE of the new CodeCommit repo created in deployment account.\nCopy all contents of this project to local mapping and push to branch to kick-off CI/CD!\n"
exit 0
