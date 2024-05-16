#!/bin/bash

#set stop on error
set -e

usage() {           
    echo "options:"
    echo "p     The AWS Credentials Profile (used for running script locally)"
    echo "r     The Resource Prefix for resource names"
    echo "y     The AWS Region for deployed management resources"
    echo "Usage: $0 [ -p awsProfile ] [ -r projectResourcePrefix ] " 1>&2 
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
while getopts :p:r:y: flag
do
    case "${flag}" in
        p) awsProfile=${OPTARG};;
        r) projectResourcePrefix=${OPTARG};;
        y) awsRegion=${OPTARG};;
    esac
done

if [ "$projectResourcePrefix" == "" || "$awsProfile" == "" || "$awsRegion" == "" ]; then
    echo "Error: (opt -p, -r and -y) must have a value"
    exit_abnormal
    exit 1
fi

pwd
origPath=$(pwd)

# declare DynamoDB Config Data Folder
declare -a dynamoDBConfigDataDirs=("./config")
pwd

echo "Update DynamoDB DevSecOps configuration data"
#https://github.com/lmammino/json-dynamo-putrequest

#Make build folder - only if doesnt already exist (-p)
mkdir -p .build
echo " Step \#1 - Finding and converting files in path ${dynamoDBConfigDataDirs[@]} to dynamo request format"

for f in ${dynamoDBConfigDataDirs[@]}/*; do
    echo " - processing file $f"
    fileName=$(basename -s .json $f)
    dynamoDbTableName="${projectResourcePrefix}-DynDBTable-${fileName}"
    json-dynamo-putrequest $dynamoDbTableName < $f > .build/${fileName}_dynamo.json  
done

echo " Step \#2 - Writing requests to dynamodb"
for outputFile in .build/*_dynamo.json; do
    echo " - uploading file $outputFile"
    #Check if awsProfile has a non-null/non-zero value
    if [ -n "${awsProfile}" ]; then
        echo " - running using local profile '${awsProfile}'"
        aws dynamodb batch-write-item --region ${awsRegion} --profile ${awsProfile} --request-items file://$outputFile 
    else
        echo " - running using default profile"
        aws dynamodb batch-write-item --region ${awsRegion} --request-items file://$outputFile
    fi
done

cd $origPath
pwd
