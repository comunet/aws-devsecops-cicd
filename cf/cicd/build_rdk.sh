#!/bin/bash

#set stop on error
set -e

echo "> Executing RDK Script"
usage() {           
    echo "options:"
    echo "l     The Lambda Role Arn to be used by RDK"
    echo "s     The S3 Output Bucket for the generated RDK files"
    echo "e     The Environment Type for the runnning execution"
    echo "Usage: $0 [ -l LambdaRoleArn ] [ -s s3OutputBucket ] [ -e environmentType ] " 1>&2 
}
exit_abnormal() {     # Function: Exit with error.
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
while getopts :l:s:e: flag
do
    case "${flag}" in
        l) LambdaRoleArn=${OPTARG};;
        s) s3OutputBucket=${OPTARG};;
        e) environmentType=${OPTARG};;
    esac
done

if [[ "$s3OutputBucket" == "" || "$LambdaRoleArn" == "" || "$environmentType" == "" ]]; then
    echo "Error: (opt -s, -l and -e) must have a value"
    exit_abnormal
    exit 1
fi

pwd
origPath=$(pwd)

#Make build folder - only if doesnt already exist (-p)
mkdir -p .build
mkdir -p ./.build/rdk/

cd code/python-rdk

# For each folder in RDK, find parameter.json, replace ENV with environmentType
for l_paramFile in $(find . -type d \( -name _template \) -prune -false -o -name 'parameters.json'); do
    echo "Updating $l_paramFile with environment type"
    sed -i "s/{ENV}/${environmentType}/g" $l_paramFile
    cat $l_paramFile
done

echo " - Deploying RDK Rules"
rdk deploy -s "all-rules-${environmentType}" --stack-name "awsconfig-allrules-lambda-${environmentType}" -f --lambda-role-arn $LambdaRoleArn --custom-code-bucket $s3OutputBucket --lambda-timeout 600

echo " - Creating Rule Template"
rdk create-rule-template -s "all-rules-${environmentType}" --rules-only -o "../../.build/rdk/awsconfig-allrules-${environmentType}.template.json"

cd $origPath
pwd
echo "> End RDK Script"