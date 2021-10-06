#!/bin/bash 

# these are the directories we want to check for lambda functions
declare -a lambdirs=("./code/nodejs/src")
pwd
origPath=$(pwd)
for p in "${lambdirs[@]}"
do
(
    for d in "$p"/*
    do
    (
    cd $d
    pwd
    if [ -f "index.js" ] && [ -f "package.json" ]; then
        # only process lambda function if the requisite files exist

        # delete node_modules folder to sure that the npm install definitely gets all the required files
        rm -rf node_modules

        npm install

        ## build the lambda package zip
        node-lambda package -A ./.build -D .
    fi
    )
    done
)
done
cd $origPath
pwd
