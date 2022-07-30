import {
  Stack,
  StackProps,
  CfnResource,
  Tags,
} from "aws-cdk-lib";
import * as cf from "aws-cdk-lib/aws-cloudformation";
import { Construct } from "constructs";
import { DefaultStackSynthesizer } from 'aws-cdk-lib';

interface MasterStackProps extends StackProps {
  masterStackName: string;
  nestedStacks: CFStacks.CloudFormationStack[];
  masterStackParams?: cf.CfnStackSet.ParameterProperty[];
  environmentType: string;
  environmentFriendlyName: string;
  projectFriendlyName: string;
  synthesizer: DefaultStackSynthesizer
}

export module CFResources {
  export class CloudFormationResources {
    resources: CloudFormationResource[];
  }
  export class CloudFormationResource {
    resourceName: string;
    resource: CfnResource;
    dependsOn?: string;
  }
}

export module CFStacks {
  export class CloudFormationEnvironments {
    env: CloudFormationEnvironment[];
  }
  export class CloudFormationEnvironment {
    environmentType: string;
    stacks: CloudFormationStack[];
  }
  export class CloudFormationStack {
    stackName: string;
    type: string;
    templateFile?: string;
    dependsOn?: string;
    timeoutInMinutes?: number;
    params?: Record<string, string>;
  }
}

export async function Cdk_MasterStack_Creator(
  scope: Construct,
  id: string,
  props: MasterStackProps,
) {
  const stack = new Stack(scope, id, props);

  const buildGuid = stack.node.tryGetContext("buildGuid") || "123456789";
  const projectResourcePrefix =
    stack.node.tryGetContext("projectResourcePrefix") || "myproject";

  let l_createdResources: CFResources.CloudFormationResources = {
    resources: [],
  };

  for (let l_nestedStack in props.nestedStacks) {
    let l_stackName: string = props.nestedStacks[l_nestedStack].stackName;

    let l_outputFileName: string = "";
    if (
      props.nestedStacks[l_nestedStack].type == "GENERATED_CDK_STACK" ||
      props.nestedStacks[l_nestedStack].type == "GENERATED_RDK_STACK"
    ) {
      l_outputFileName = `${props.nestedStacks[l_nestedStack].stackName}.template.json`;
    } else {
      l_outputFileName = `${props.nestedStacks[l_nestedStack].templateFile}`;
    }
    let l_timeoutInMinutes: number =
      props.nestedStacks[l_nestedStack].timeoutInMinutes || 30;
    let templateUrl: string = `https://${projectResourcePrefix}-artifacts-codebuild.s3.amazonaws.com/${buildGuid}/${l_outputFileName}`;

    let l_param = props.nestedStacks[l_nestedStack].params || {};

    let l_stack = new cf.CfnStack(stack, l_stackName, {
      templateUrl: templateUrl,
      timeoutInMinutes: l_timeoutInMinutes,
      parameters: l_param,
    });

    let l_purpose: string = "DevSecOps Orchestration Stack";
    Tags.of(l_stack).add("Name", l_stackName);
    Tags.of(l_stack).add("Project", props.projectFriendlyName);
    Tags.of(l_stack).add("Purpose", l_purpose);
    Tags.of(l_stack).add("Environment", props.environmentFriendlyName);

    let l_newResource: CFResources.CloudFormationResource = {
      resourceName: l_stackName,
      dependsOn: props.nestedStacks[l_nestedStack].dependsOn || undefined,
      resource: l_stack,
    };
    l_createdResources.resources?.push(l_newResource);
  }

  //With all stacks created, now add in any dependancies
  for (let l_resource in l_createdResources.resources) {
    let l_resourceName = l_createdResources.resources[l_resource].resourceName;

    if (l_createdResources.resources[l_resource].dependsOn || "" !== "") {
      //Do a lookup to find the dependant resource:
      let l_dependantResource = stack.node.findChild(l_resourceName);
      let l_dependantOnResource = stack.node.findChild(
        l_createdResources.resources[l_resource].dependsOn || ""
      );
      l_dependantResource.node.addDependency(l_dependantOnResource);
      console.log(
        ` - dependancy added on ${l_resourceName} to ${l_createdResources.resources[l_resource].dependsOn}`
      );
    }
  }

  return {
    stack,
    l_createdResources,
  };
}
