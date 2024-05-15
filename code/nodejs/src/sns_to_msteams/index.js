var https = require('https');
var util = require('util');

const l_project_name = process.env.PROJECT_NAME;
const l_project_prefix = process.env.PROJECT_PREFIX;
const l_project_masteraccount = process.env.MASTER_DEPLOYMENT_ACCOUNT;
const l_iconbucketurl = "http://devsecops-cicd-public-assets.s3-website-ap-southeast-2.amazonaws.com";

const _getPrivateKeyValue = async function (secret_key) {
    const AWS = require('aws-sdk');
    const client = new AWS.SecretsManager({
        region: process.env.AWS_REGION
    });
    return new Promise((resolve, reject) => {
        client.getSecretValue({ SecretId: secret_key }, function (err, data) {
            if (err) {
                reject(err);
            }
            else {
                if ('SecretString' in data) {
                    resolve(JSON.parse(data.SecretString));
                }
                else {
                    let buff = new Buffer(data.SecretBinary, 'base64');
                    resolve(JSON.parse(buff.toString('ascii')));
                }
            }
        });
    });
};

/**
 * Do a request with options provided.
 *
 * @param {Object} options
 * @param {Object} data
 * @return {Promise} a promise of request
 */
function doRequest(options, data) {
    return new Promise((resolve, reject) => {
        const req = https.request(options, (res) => {
            res.setEncoding('utf8');
            let responseBody = '';

            res.on('data', (chunk) => {
                responseBody += chunk;
            });

            res.on('end', () => {
                console.log('response: '+ responseBody);
                resolve(responseBody);
            });
        });

        req.on('error', (err) => {
            reject(err);
        });

        req.write(data);
        req.end();
    });
}

exports.handler = async (event) => {
    console.log(JSON.stringify(event, null, 2));
    console.log('From SNS:' + event.Records[0].Sns.Message);

    var l_msg = JSON.parse(event.Records[0].Sns.Message);
    //Set Defaults
    var l_title = "";
    var l_state = "succeeded";
    var l_env = "PROD";
    var l_msgdetail = "";
    var l_pipeline = "";
    var l_subject = "";
    var l_iconName = "";
    var l_facts = [];

    var severityColor = '0072C6'; //light blue
    var potentialActions = [];
    if (l_msg.hasOwnProperty('approval')) {
        l_state = "approval";
        l_pipeline = l_msg.approval.pipelineName;
        l_iconName = "question_icon.png";
        l_facts.push({"name":"Pipeline name","value": l_pipeline});

        potentialActions.push({"@type":"OpenUri", "name":"Approve/Reject", "targets": [{"os" : "default", "uri": l_msg.approval.approvalReviewLink}]});
        //First remove any linebreaks added by GIT.
        var l_customData = l_msg.approval.customData.replace(/(\r\n|\n|\r)/gm, "");
        //Parse as JSON
        var l_jsonData = JSON.parse(l_customData);
        l_title = l_jsonData.title;
        l_msgdetail = l_jsonData.message;
        console.log(JSON.stringify(l_jsonData));
        l_facts.push({"name":"Commit Message","value": l_jsonData.git_commit_msg});
        l_subject = `CI/CD deployment for *'${l_project_name}' to 'PROD'* requires manual approval.`;
        
    } else if (l_msg.detail.hasOwnProperty('state')) {
        l_pipeline = l_msg.detail.pipeline;
        if (l_msg.detail.state == "STARTED") {
            l_state = "started";
            severityColor = "000000"; //black
        } else if (l_msg.detail.state == "SUCCEEDED") {
            if (l_msg.detail.stage == "Manual-QA-Approval") {
                l_state = "approved";
                severityColor = "00aeef"; //lightblue
                l_iconName = "approved_icon.png";
            } else {
                l_state = "succeeded";
                severityColor = "32CD32"; //limegreen
                l_iconName = "success_icon.png";
            }
        } else if(l_msg.detail.state == "FAILED") {
            if (l_msg.detail.stage == "Manual-QA-Approval") {
                l_state = "approval denied";
                severityColor = "FF8C00"; //darkorange
                l_iconName = "denied_icon.png";
            } else {
                l_state = "failed";
                severityColor = "FF0000"; //red
                l_iconName = "error_icon.png";
            }
        } else {
            l_state = "unknown";
            severityColor = "FF8C00"; //darkorange
            l_iconName = "unknown_icon.png";
        }

        if (l_msg.detail.hasOwnProperty('stage')) {
            if (l_msg.detail.stage == "Source") {
                l_env = "DEV";
            } else {
                l_facts.push({"name":"Stage","value": l_msg.detail.stage});
                if (l_msg.detail.stage == "Build-CloudFormation-Resources") {
                    l_env = "DEV";
                } else if (l_msg.detail.stage == "Dev-Infrastructure-Deploy") {
                    l_env = "DEV";
                } else if(l_msg.detail.stage == "Test-Infrastructure-Deploy") {
                    l_env = "TEST";
                } else if (l_msg.detail.stage == "Manual-QA-Approval") {
                    l_env = "PROD";
                } else {
                    l_env = "PROD";
                }
            }
        }
        if (l_msg.detail.state != "STARTED") {
            l_facts.push({"name":"Pipeline name","value": l_pipeline});
            l_facts.push({"name":"AWS Master Account","value": l_project_masteraccount});
            l_facts.push({"name":"Project Prefix","value": l_project_prefix});
        }
        if (l_state == "started") {
            l_subject = `CI/CD pipeline for *${l_project_name}* started..`;
        } else if (l_state == "approval denied") {
            l_subject = `Deployment approval denied for *${l_project_name}* to publish to *${l_env}*`;
        } else {
            l_subject = `CI/CD pipeline for *${l_project_name}* to *${l_env}, ${l_state}!*`;
        }
    }
    console.log('Subject: ' + l_subject);

    const private_key_value = await _getPrivateKeyValue("MSTeamsSettings");
    var l_msTeamsHostname = private_key_value["msTeamsHostname"];
    var l_msTeamsWebHookPath = private_key_value["msTeamsWebHookPath"];

    var postData = {
        '@type': 'MessageCard',
        '@context': 'http://schema.org/extensions',
        'themeColor': severityColor,
        'summary': l_subject,
        "sections": [{
            "activityTitle": l_subject,
            "activitySubtitle": l_msgdetail,
            "facts": l_facts,
        "markdown": true
        }]
    };
    if (l_iconName.length > 0) {
        postData.sections[0].activityImage = `${l_iconbucketurl}/images/${l_iconName}`;
    }
    if (l_title.length > 0) {
        postData.title = l_title;
    }
    if (potentialActions.length > 0) {
        postData.potentialAction = potentialActions;
    }
    
    var options = {
        method: 'POST',
        hostname: l_msTeamsHostname,
        port: 443,
        path: l_msTeamsWebHookPath,
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(JSON.stringify(postData))
        }
    };

    // return the response
    return await doRequest(options, JSON.stringify(postData));
};
