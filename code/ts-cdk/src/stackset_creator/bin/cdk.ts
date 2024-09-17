#!/usr/bin/env node
import "source-map-support/register";
import * as cdk from "aws-cdk-lib";
import {
  StackInstances,
  Cdk_StackSet_Creator,
} from "../lib/cdk_stackset_creator";
import {
  CFStacks,
  Cdk_MasterStack_Creator,
} from "../lib/cdk_master_stack_creator";
import {
  ScanCommand,
  ScanCommandInput,
  QueryCommand,
  QueryCommandInput,
} from "@aws-sdk/lib-dynamodb";
import { ddbDocClient } from "../lib/ddbDocClient";
import { CFEnvironmentParameters } from "../lib/cfModels";
import * as cf from "aws-cdk-lib/aws-cloudformation";
import { DefaultStackSynthesizer } from "aws-cdk-lib";

function pop(object: any, propertyName: any) {
  let temp = object[propertyName];
  delete object[propertyName];
  return temp;
}

//Function to assist filtering arrays to only return unique values
function onlyUnique(value: string, index: number, self: string[]) {
  return self.indexOf(value) === index;
}

async function createApp(): Promise<cdk.App> {
  let app = new cdk.App();

  let l_generatedStacks = [];

  let l_buildGuid = app.node.tryGetContext("buildGuid") || "123456789";
  let l_awsAccountId = app.node.tryGetContext("awsAccountId") || "123456789012";
  let l_projectResourcePrefix =
    app.node.tryGetContext("projectResourcePrefix") || "myproject";
  let l_projectFriendlyName =
    app.node.tryGetContext("projectFriendlyName") || "my project";

  // Get Global Parameters Configuration
  let gp_params: ScanCommandInput = {
    TableName: `${l_projectResourcePrefix}-DynDBTable-GlobalParams`,
  };
  let gp_command = new ScanCommand(gp_params);
  let gp_data = await ddbDocClient.send(gp_command);

  // console.log(gp_data);

  let g_stacksList: CFStacks.CloudFormationEnvironments = {
    env: [],
  };
  let g_globalParamList: CFEnvironmentParameters.CFParams = {
    env: [],
  };
  for (let l_envItem in gp_data.Items[0].env) {
    let l_envParams: CFEnvironmentParameters.CFEnvParameterProperty = {
      environmentType: gp_data.Items[0].env[l_envItem].environmentType,
      environmentFriendlyName:
        gp_data.Items[0].env[l_envItem].environmentFriendlyName,
      retainStacksOnAccountRemoval:
        gp_data.Items[0].env[l_envItem].defaultRetainStacksOnAccountRemoval,
      params: [],
    };

    let l_fieldNameEnvironmentType = "EnvironmentType";
    let l_fieldNameEnvironmentFriendlyName = "EnvironmentFriendlyName";
    let l_fieldNameProjectFriendlyName = "ProjectFriendlyName";
    let l_fieldNameBuildGuid = "BuildGuid";
    let l_fieldPrefixGlobalParams = "GLOBAL";

    //Add EnvType and EnvFriendlyName as Global Params
    l_envParams.params.push({
      parameterUniqueKey: `${l_fieldPrefixGlobalParams}-${l_fieldNameEnvironmentType}`,
      parameterKey: l_fieldNameEnvironmentType,
      parameterValue: gp_data.Items[0].env[l_envItem].environmentType,
    });
    l_envParams.params.push({
      parameterUniqueKey: `${l_fieldPrefixGlobalParams}-${l_fieldNameEnvironmentFriendlyName}`,
      parameterKey: l_fieldNameEnvironmentFriendlyName,
      parameterValue: gp_data.Items[0].env[l_envItem].environmentFriendlyName,
    });

    for (let l_gparam in gp_data.Items[0].env[l_envItem].globalparams) {
      let l_globalParamUniqueKey = `${l_fieldPrefixGlobalParams}-${l_gparam}`; //This could be useful if referencing all params from masterstack.
      let l_globalParamKey = `${l_gparam}`;
      let l_globalParamValue = `${gp_data.Items[0].env[l_envItem].globalparams[l_gparam]}`;

      //Set the Project Friendly name from the Global Param.
      if (l_globalParamKey == l_fieldNameProjectFriendlyName) {
        l_projectFriendlyName = l_globalParamValue;
      }
      //Replace placeholder Global Param 'BuildGuid' with unique guid generated from buildspec
      if (l_globalParamKey == l_fieldNameBuildGuid) {
        l_globalParamValue = l_buildGuid;
      }

      let l_param: CFEnvironmentParameters.CFParameterProperty = {
        parameterUniqueKey: l_globalParamUniqueKey,
        parameterKey: l_globalParamKey,
        parameterValue: l_globalParamValue,
      };
      l_envParams.params.push(l_param);
    }
    g_globalParamList.env.push(l_envParams);

    //Also add placeholder in stacklist for env
    g_stacksList.env.push({
      environmentType: gp_data.Items[0].env[l_envItem].environmentType,
      stacks: [],
    });
  }

  // Get deep copy of param objects and deployment groups. We keep:
  // - a global params list used to add to each generated nested stack parameters
  // - a master params list which includes global params and all nested stack params
  let g_masterParamList = JSON.parse(JSON.stringify(g_globalParamList));
  let g_environments = JSON.parse(JSON.stringify(gp_data.Items[0].env));

  // StackSet Configuration
  let l_stacks_params: ScanCommandInput = {
    TableName: `${l_projectResourcePrefix}-DynDBTable-Stacks`,
  };
  let l_stacks_command = new ScanCommand(l_stacks_params);
  let l_stacks_data = await ddbDocClient.send(l_stacks_command);

  for (let l_stack of l_stacks_data.Items) {
    if (l_stack.enabled != null && l_stack.enabled == "false") {
      console.log(
        `* Skipping ${l_stack.type} - ${l_stack.name} - set to disabled`
      );
      //skip disabled stack
      continue;
    }
    console.log(`* Generating ${l_stack.type} - ${l_stack.name}`);

    let l_stackParamList: CFEnvironmentParameters.CFParams = {
      env: [],
    };
    for (let l_envsettings of l_stack.env) {
      let l_stack_dependsOn = undefined;
      if (l_stack.dependsOn !== undefined) {
        l_stack_dependsOn = `${l_stack.dependsOn}-${l_envsettings.environmentType}`;
        console.log(` - stack depends on = '${l_stack_dependsOn}'`);
      }

      let l_stack_retainStacksOnAccountRemoval = undefined;
      if (l_stack.retainStacksOnAccountRemoval !== undefined) {
        // Use Stack-specific Setting
        l_stack_retainStacksOnAccountRemoval =
          l_stack.retainStacksOnAccountRemoval;
      } else {
        // Use global setting
        l_stack_retainStacksOnAccountRemoval =
          g_globalParamList.env.find(function (item: any) {
            return item.environmentType === l_envsettings.environmentType;
          })?.retainStacksOnAccountRemoval || "true";
      }
      //Get Environment Friendly Name from Global Setting (not a stack setting)
      let l_stack_environmentFriendlyName =
        g_globalParamList.env.find(function (item: any) {
          return item.environmentType === l_envsettings.environmentType;
        })?.environmentFriendlyName || "ERROR";

      let l_envStackParams: CFEnvironmentParameters.CFEnvParameterProperty = {
        environmentType: l_envsettings.environmentType,
        environmentFriendlyName: l_stack_environmentFriendlyName,
        retainStacksOnAccountRemoval: l_stack_retainStacksOnAccountRemoval,
        params: [],
      };
      // let l_stackSetParams: cf.CfnStackSet.ParameterProperty[] = [];
      console.log(` - env = ${l_envsettings.environmentType}`);

      //Get local params for env
      for (let l_paramName in l_envsettings.localparams) {
        let stackParamUniqueKey = `${l_stack.name}-${l_paramName}`; //This could be useful if referencing all params from masterstack.
        let stackParamKey = `${l_paramName}`;
        let stackParamValue = l_envsettings.localparams[l_paramName];
        let l_stackParam: CFEnvironmentParameters.CFParameterProperty = {
          parameterUniqueKey: stackParamUniqueKey,
          parameterKey: stackParamKey,
          parameterValue: stackParamValue,
        };
        l_envStackParams.params.push(l_stackParam);

        //Add param to the master list
        for (let l_env in g_masterParamList.env) {
          if (
            g_masterParamList.env[l_env].environmentType ===
            l_envsettings.environmentType
          ) {
            g_masterParamList.env[l_env].params.push(l_stackParam);
          }
        }
      }
      //Then add any global settings to the local stack
      if (l_stack.type !== "rdkstackset") {
        for (let l_env in g_globalParamList.env) {
          if (
            g_globalParamList.env[l_env].environmentType ===
            l_envsettings.environmentType
          ) {
            l_envStackParams.params = l_envStackParams.params.concat(
              g_globalParamList.env[l_env].params
            );
          }
        }
      } else {
        //With RDK Stacksets, dont include any global params, instead auto generate a LambdaAccountId pram with current Account Id
        let l_stackParam: CFEnvironmentParameters.CFParameterProperty = {
          parameterUniqueKey: `${l_stack.name}-LambdaAccountId`,
          parameterKey: "LambdaAccountId",
          parameterValue: l_awsAccountId,
        };
        l_envStackParams.params.push(l_stackParam);
      }
      //Complete the local Stack Param List
      l_stackParamList.env.push(l_envStackParams);

      if (l_stack.type == "stackset" || l_stack.type == "rdkstackset") {
        //Create stackset

        //First, lets determine which DeploymentGroup the Stack will be deployed to.
        let l_deploymentGroupCode: string = "";
        if (
          l_envsettings.overrideDeploymentGroup != null &&
          l_envsettings.overrideDeploymentGroup != ""
        ) {
          //Use Override Deployment group specific for Stack
          console.log(
            ` - override deployment group - ${l_envsettings.overrideDeploymentGroup}`
          );
          l_deploymentGroupCode = l_envsettings.overrideDeploymentGroup;
        } else {
          //Use Global Setting for the Env
          let l_globalEnvNode = g_environments.find(function (item: any) {
            return item.environmentType === l_envsettings.environmentType;
          });
          console.log(
            ` - default deployment group - ${l_globalEnvNode.defaultDeploymentGroup}`
          );
          l_deploymentGroupCode = l_globalEnvNode.defaultDeploymentGroup;
        }

        let l_stackInstanceGroups: StackInstances.StackInstanceGroups = {
          groups: [],
        };

        //Lookup Deployment Group, get TargetRegions
        let dg_params: QueryCommandInput = {
          TableName: `${l_projectResourcePrefix}-DynDBTable-DeploymentGroups`,
          KeyConditionExpression: "groupCode = :o",
          ExpressionAttributeValues: {
            ":o": l_deploymentGroupCode,
          },
        };
        let dg_command = new QueryCommand(dg_params);
        let dg_data = await ddbDocClient.send(dg_command);

        if (dg_data.Items.length == 1) {
          for (let l_targetRegion of dg_data.Items[0].targetRegions) {
            //Each TargetRegion is a collection of OrgUnitIds +/- Accounts which will share the same target regions.
            //Setup your json file to ensure orgunits/accounts in a TargetRegion do not mix regions you dont want to deploy to.
            let l_deploymentOrgUnitIdsValues: string[] = [];
            let l_deploymentAccountIdsValues: string[] = [];
            let l_deployRegions: string[] = [];

            let l_hasAccountIds = false;
            let l_hasOrgUnitIds = false;

            //AccountFilterType Defaults to NONE if no AccountIds exist
            let l_accountFilterType: string = "NONE";

            l_deploymentOrgUnitIdsValues = l_targetRegion.orgUnitIds;
            l_deploymentAccountIdsValues = l_targetRegion.accountIds;

            if (
              l_targetRegion.accountFilterType == undefined ||
              l_targetRegion.accountFilterType == null
            ) {
              if (
                l_deploymentAccountIdsValues != undefined &&
                l_deploymentAccountIdsValues != null &&
                l_deploymentAccountIdsValues.length > 0
              ) {
                //Default if AccountIds exist but no account filter exists
                l_accountFilterType = "INTERSECTION";
              }
            } else {
              //Use setting as defined.
              l_accountFilterType = l_targetRegion.accountFilterType;
            }

            //Ok, now we need to lookup the correct regions this TargetRegion group will target.
            if (
              l_envsettings.overrideDeploymentRegions != null &&
              l_envsettings.overrideDeploymentRegions.length > 0
            ) {
              //If the stack specifically overrides regions, use this setting,
              console.log(
                ` - adding override region(s) (${l_envsettings.overrideDeploymentRegions}) to targetRegion`
              );
              l_deployRegions = l_deployRegions.concat(l_envsettings.overrideDeploymentRegions);
            } else {
              //Otherwise lookup the correct regions.. start with OrgUnitIds
              if (
                l_deploymentOrgUnitIdsValues != undefined &&
                l_deploymentOrgUnitIdsValues != null &&
                l_deploymentOrgUnitIdsValues.length > 0
              ) {
                for (let _ou in l_deploymentOrgUnitIdsValues) {
                  l_hasOrgUnitIds = true;
                  let ou_params: QueryCommandInput = {
                    TableName: `${l_projectResourcePrefix}-DynDBTable-OrgUnits`,
                    KeyConditionExpression: "orgUnitId = :o",
                    ExpressionAttributeValues: {
                      ":o": l_deploymentOrgUnitIdsValues[_ou],
                    },
                  };
                  let ou_command = new QueryCommand(ou_params);
                  let ou_data = await ddbDocClient.send(ou_command);

                  //Add to region list
                  for (let l_ouItem of ou_data.Items) {
                    if (
                      l_envsettings.overrideDeploymentRegionUseDefaultOnly !==
                        undefined &&
                      l_envsettings.overrideDeploymentRegionUseDefaultOnly ===
                        "true"
                    ) {
                      //Set to deploy only to default region
                      console.log(
                        ` - adding default region (${l_ouItem.defaultRegion}) only to targetRegion`
                      );
                      l_deployRegions = l_deployRegions.concat([l_ouItem.defaultRegion]);
                    } else {
                      //Set to all deployment regions listed in OU
                      console.log(
                        ` - adding all listed deployment region(s) (${l_ouItem.deploymentRegions}) to targetRegion`
                      );
                      l_deployRegions = l_deployRegions.concat(l_ouItem.deploymentRegions);
                    }
                  }
                }
              }
              //Now AccountIds
              if (
                l_deploymentAccountIdsValues != undefined &&
                l_deploymentAccountIdsValues != null &&
                l_deploymentAccountIdsValues.length > 0
              ) {
                for (let _acc in l_deploymentAccountIdsValues) {
                  l_hasAccountIds = true;
                  let acc_params: QueryCommandInput = {
                    TableName: `${l_projectResourcePrefix}-DynDBTable-Accounts`,
                    KeyConditionExpression: "accountId = :o",
                    ExpressionAttributeValues: {
                      ":o": l_deploymentAccountIdsValues[_acc],
                    },
                  };
                  let acc_command = new QueryCommand(acc_params);
                  let acc_data = await ddbDocClient.send(acc_command);

                  //Add to region list
                  for (let l_accItem of acc_data.Items) {
                    if (
                      l_envsettings.overrideDeploymentRegionUseDefaultOnly !==
                        undefined &&
                      l_envsettings.overrideDeploymentRegionUseDefaultOnly ===
                        "true"
                    ) {
                      //Set to deploy only to default region
                      console.log(
                        ` - adding default region (${l_accItem.defaultRegion}) only to targetRegion`
                      );
                      l_deployRegions = l_deployRegions.concat([l_accItem.defaultRegion]);
                    } else {
                      //Set to all deployment regions listed in OU
                      console.log(
                        ` - adding all listed deployment region(s) (${l_accItem.deploymentRegions}) to targetRegion`
                      );
                      l_deployRegions = l_deployRegions.concat(l_accItem.deploymentRegions);
                    }
                  }
                }
              }
            }
            //End of building up region list
            console.log(
              ` - list of regions (prior to unique): ${l_deployRegions}`
            );
            console.log(
              ` - list of regions (unique): ${l_deployRegions.filter(onlyUnique)}`
            );

            let l_deploymentTargetsProperty: cf.CfnStackSet.DeploymentTargetsProperty =
              {
                accountFilterType: l_accountFilterType,
                ...(l_hasAccountIds && {
                  accounts: l_deploymentAccountIdsValues,
                }),
                ...(l_hasOrgUnitIds && {
                  organizationalUnitIds: l_deploymentOrgUnitIdsValues,
                }),
              };

            let l_stackInstanceGroup: cf.CfnStackSet.StackInstancesProperty = {
              deploymentTargets: l_deploymentTargetsProperty,
              regions: l_deployRegions.filter(onlyUnique),
              parameterOverrides: l_envStackParams.params,
            };
            l_stackInstanceGroups.groups?.push(l_stackInstanceGroup);
          }
        }
        //Create StackSet
        let l_stackSetName = `${l_stack.name}-${l_envsettings.environmentType}`;
        //If templateFile includes environment variable {ENV} - replace with environmentType
        let re = /{ENV}/gi;
        let l_stacksetTemplateFile = l_stack.templateFile.replace(
          re,
          l_envsettings.environmentType
        );
        let l_stackDescription = `${l_stack.description}`;
        let l_parentStackDescription = `Generated CDK stack '${l_stack.name}' from project '${l_projectFriendlyName}' (env=${l_envsettings.environmentType})`;
        let myStack1 = Cdk_StackSet_Creator(app, l_stackSetName, {
          stackSetName: l_stackSetName,
          stackSetTemplateFile: l_stacksetTemplateFile,
          stackDescription: l_stackDescription,
          // description: l_parentStackDescription,
          retainStacksOnAccountRemoval:
            l_envStackParams.retainStacksOnAccountRemoval === "true"
              ? true
              : false,
          stackParams: l_envStackParams.params,
          stackInstanceGroups: l_stackInstanceGroups,
          environmentFriendlyName: l_stack_environmentFriendlyName,
          environmentType: l_envsettings.environmentType,
          projectFriendlyName: l_projectFriendlyName,
          synthesizer: new DefaultStackSynthesizer({
            generateBootstrapVersionRule: false,
          }),
        });
        let l_type = "GENERATED_CDK_STACK";
        if (l_stack.type == "rdkstackset") {
          l_type = "GENERATED_RDK_STACK";
        }
        let l_stackItem: CFStacks.CloudFormationStack = {
          stackName: l_stackSetName,
          type: "GENERATED_CDK_STACK",
          dependsOn: l_stack_dependsOn,
        };
        let l_envStackListNode = g_stacksList.env.find(function (item: any) {
          return item.environmentType === l_envsettings.environmentType;
        });
        l_envStackListNode?.stacks.push(l_stackItem);
        l_generatedStacks.push(myStack1); //not really needed
      } else {
        //Create stack
        let l_stackName = `${l_stack.name}-${l_envsettings.environmentType}`;
        let re = /{ENV}/gi;
        let l_stackTemplateFile = l_stack.templateFile.replace(
          re,
          l_envsettings.environmentType
        );
        let l_envStackListNode = g_stacksList.env.find(function (item: any) {
          return item.environmentType === l_envsettings.environmentType;
        });
        let l_params = CFEnvironmentParameters.ConvertCFParameterListToRecords(
          l_envStackParams.params
        );
        let l_type = "EXTERNAL_CF_TEMPLATE";
        let l_stackItem: CFStacks.CloudFormationStack = {
          stackName: l_stackName,
          type: l_type,
          templateFile: l_stackTemplateFile,
          params: l_params,
          dependsOn: l_stack_dependsOn,
        };
        l_envStackListNode?.stacks.push(l_stackItem);
      }
    }
  }

  //Build a Master Stack
  for (let l_env in g_globalParamList.env) {
    //Get Nested Stacks
    let l_NestedStacks = g_stacksList.env.find(function (item: any) {
      return (
        item.environmentType === g_globalParamList.env[l_env].environmentType
      );
    });
    let l_stackName = `MasterStack-${g_globalParamList.env[l_env].environmentType}`;
    let myMasterStack1 = Cdk_MasterStack_Creator(app, l_stackName, {
      environmentFriendlyName:
        g_globalParamList.env[l_env].environmentFriendlyName,
      environmentType: g_globalParamList.env[l_env].environmentType,
      description: `Generated CDK Master Stack for project '${l_projectFriendlyName}' (env=${g_globalParamList.env[l_env].environmentType})`,
      masterStackName: l_stackName,
      nestedStacks: l_NestedStacks?.stacks || [],
      projectFriendlyName: l_projectFriendlyName,
      synthesizer: new DefaultStackSynthesizer({
        generateBootstrapVersionRule: false,
      }),
    });
  }

  return app;
}

createApp();
