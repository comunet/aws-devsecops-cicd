import {
  Stack,
  StackProps,
  CfnResource,
  Tags,
} from "aws-cdk-lib";
import * as cf from "aws-cdk-lib/aws-cloudformation";
import { Construct } from "constructs";
import { DefaultStackSynthesizer } from 'aws-cdk-lib';

interface StackSetCreatorProps extends StackProps {
  stackSetName: string;
  stackSetTemplateFile: string,
  stackDescription: string;
  retainStacksOnAccountRemoval?: boolean;
  stackParams?: cf.CfnStackSet.ParameterProperty[],
  stackInstanceGroups?: StackInstances.StackInstanceGroups,
  environmentType: string,
  environmentFriendlyName: string,
  projectFriendlyName: string
  synthesizer: DefaultStackSynthesizer
}

export module StackInstances {
  export class StackInstanceGroups {
    groups?: cf.CfnStackSet.StackInstancesProperty[];
  }
}

export async function Cdk_StackSet_Creator(scope: Construct, id: string, props: StackSetCreatorProps) {
  const stack = new Stack(scope, id, props);

  const buildGuid = stack.node.tryGetContext('buildGuid') || '123456789';
  const projectResourcePrefix = stack.node.tryGetContext('projectResourcePrefix') || 'myproject';

  let templateUrl: string = `https://${projectResourcePrefix}-artifacts-codebuild.s3.amazonaws.com/${buildGuid}/${props.stackSetTemplateFile}`;

  let l_stackInstanceGroups: cf.CfnStackSet.StackInstancesProperty[] = [];
  console.log(` - stack instance '${props.stackSetName}' deployment groups`);
  //For each Deployment Group
  for (let l_groups in props.stackInstanceGroups!.groups!) {
    console.log(props.stackInstanceGroups!.groups![l_groups]);
    l_stackInstanceGroups.push(props.stackInstanceGroups!.groups![l_groups]);
  }

  // var instance = new StackInstances();
  let l_stackset = new cf.CfnStackSet(stack, props.stackSetName, {
    templateUrl: templateUrl,
    stackSetName: props.stackSetName,
    description: props.stackDescription,
    permissionModel: "SERVICE_MANAGED",
    callAs: "DELEGATED_ADMIN", 
    stackInstancesGroup: l_stackInstanceGroups,
    autoDeployment: {
      enabled: true,
      retainStacksOnAccountRemoval: props.retainStacksOnAccountRemoval
    },
    capabilities: ["CAPABILITY_IAM", "CAPABILITY_NAMED_IAM"],
    parameters: props.stackParams,
    operationPreferences: {
      failureToleranceCount: 2,
      maxConcurrentCount: 10
    }
  });
  let l_purpose :string = "DevSecOps Orchestration Stack";
  Tags.of(l_stackset).add('Name', props.stackSetName);
  Tags.of(l_stackset).add('Project', props.projectFriendlyName);
  Tags.of(l_stackset).add('Purpose', l_purpose);
  Tags.of(l_stackset).add('Environment', props.environmentFriendlyName);

  return {
    stack,
    l_stackset,
  };
}
