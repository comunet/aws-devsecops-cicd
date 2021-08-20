#!/bin/bash 

#set stop on error
set -e

usage() {           
    echo "options:"
    echo "b     The unique BuildGuid"
    echo "p     The AWS Credentials Profile (used for running script locally)"
    echo "r     The Resource Prefix for resource names"
    echo "Usage: $0 [ -b buildGuid ] [ -p awsProfile ] [ -r projectResourcePrefix ] " 1>&2 
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
while getopts :b:p:r: flag
do
    case "${flag}" in
        b) buildGuid=${OPTARG};;
        p) awsProfile=${OPTARG};;
        r) projectResourcePrefix=${OPTARG};;
    esac
done

if [[ "$buildGuid" == "" || "$projectResourcePrefix" == "" ]]; then
    echo "Error: (opt -b and -r) must have a value"
    exit_abnormal
    exit 1
fi

pwd
origPath=$(pwd)
# move to CDK location
declare -a tscdkdirs=("./lambda/ts-cdk/src")
pwd
for p in "${tscdkdirs[@]}"
do
(
    for d in "$p"/*
    do
    (
    cd $d
    pwd
    if [ -f "cdk.json" ] && [ -f "package.json" ]; then
        # only process CDK function if the requisite files exist
        cdkProjectName=${PWD##*/}          # to assign to a variable
        npm install
        npm run build;

        #Check if awsProfile has a non-null/non-zero value
        if [ -n "${awsProfile}" ]; then
            echo "Running using local profile '${awsProfile}'"
            cdk synth --context buildGuid=${buildGuid} --context awsprofile=${awsProfile} --context projectResourcePrefix=${projectResourcePrefix} -o=${origPath}/.build/cdk
        else
            echo "Running using default profile"
            cdk synth --context buildGuid=${buildGuid} --context projectResourcePrefix=${projectResourcePrefix} -o=${origPath}/.build/cdk
        fi
    fi
    )
    done
)
done
cd $origPath
pwd