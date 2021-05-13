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
    var l_state = "succeeded";
    var l_env = "PROD";
    var l_title = "";
    var l_msgdetail = "";
    var l_pipeline = "";
    var l_subject = "";
    var l_iconName = "";
    var l_approvalSection = {};

    var l_blocks = [];
    var l_fields = [];

    if (l_msg.hasOwnProperty('approval')) {
        l_state = "approval";
        l_pipeline = l_msg.approval.pipelineName;
        l_iconName = "question_icon_trans.png";
        l_fields.push({"type": "mrkdwn","text": `*Pipeline name:*\n${l_pipeline}`});

        //First remove any linebreaks added by GIT.
        var l_customData = l_msg.approval.customData.replace(/(\r\n|\n|\r)/gm, "");
        //Parse as JSON
        var l_jsonData = JSON.parse(l_customData);

        l_approvalSection = {
            "type": "section",
            "text": {
                "type": "mrkdwn",
                "text": l_jsonData.message
            },
            "accessory": {
                "type": "button",
                "text": {
                    "type": "plain_text",
                    "text": "Approve/Reject",
                },
                "value": "notimportant",
                "url": l_msg.approval.approvalReviewLink,
                "action_id": "button-action"
            }
        };

        l_title = l_jsonData.title;
        l_msgdetail = l_jsonData.message;
        console.log(JSON.stringify(l_jsonData));
        l_fields.push({"type": "mrkdwn","text": `*Commit Message:*\n${l_jsonData.git_commit_msg}` });
        l_subject = `CI/CD deployment for *'${l_project_name}' to 'PROD'* requires manual approval.`;

    } else if (l_msg.detail.hasOwnProperty('state')) {
        l_pipeline = l_msg.detail.pipeline;
        if (l_msg.detail.state == "STARTED") {
            l_state = "started";
        } else if (l_msg.detail.state == "SUCCEEDED") {
            if (l_msg.detail.stage == "Manual-QA-Approval") {
                l_state = "approved";
                l_iconName = "approved_icon_trans.png";
            } else {
                l_state = "succeeded";
                l_iconName = "success_icon_trans.png";
            }
        } else if(l_msg.detail.state == "FAILED") {
            if (l_msg.detail.stage == "Manual-QA-Approval") {
                l_state = "approval denied";
                l_iconName = "denied_icon_trans.png";
            } else {
                l_state = "failed";
                l_iconName = "error_icon_trans.png";
            }
        } else {
            l_state = "unknown";
            l_iconName = "unknown_icon_trans.png";
        }

        if (l_msg.detail.hasOwnProperty('stage')) {
            if (l_msg.detail.stage == "Source") {
                l_env = "DEV";
            } else {
                l_fields.push({"type": "mrkdwn","text": `*Stage:*\n${l_msg.detail.stage}` });
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
            l_fields.push({"type": "mrkdwn","text": `*Pipeline name:*\n${l_pipeline}`});
            l_fields.push({"type": "mrkdwn","text": `*AWS Master Account:*\n${l_project_masteraccount}` });
            l_fields.push({"type": "mrkdwn","text": `*Project Prefix:*\n${l_project_prefix}` });
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

    const private_key_value = await _getPrivateKeyValue("SlackSettings");
    var l_slackChannelName = private_key_value["slackChannelName"];
    var l_slackWebHookPath = private_key_value["slackWebHookPath"];

    console.log('Posting to slack channel:' + l_slackChannelName);

    var postData = {
        "channel": l_slackChannelName,
    };
    
    //Add Header
    if (l_subject.length > 0) {
        var l_header = { 
            "type": "section", 
            "text": 
                { 
                    "type": "mrkdwn", 
                    "text": l_subject
                }
            };
        l_blocks.push(l_header);
    }
    //Add Msg Prop Section
    if (l_fields.length > 0) {
        //Add Section for Fields
        var l_section = { 
            "type": "section", 
            "fields": l_fields
        };
        //Add Image
        if (l_iconName.length > 0) {
            l_section.accessory = { 
                "type": "image", 
                "image_url": `${l_iconbucketurl}/images/${l_iconName}`, 
                "alt_text": l_state
            };
        }
        l_blocks.push(l_section);
    }
    //Add Approval
    if (l_msg.hasOwnProperty('approval')) {
        l_blocks.push(l_approvalSection);
    }
    postData.blocks = l_blocks;
    console.log('Posting Data:\n' +  JSON.stringify(postData));
    var options = {
        method: 'POST',
        hostname: 'hooks.slack.com',
        port: 443,
        path: l_slackWebHookPath
    };

    // return the response
    return await doRequest(options, JSON.stringify(postData));
};
