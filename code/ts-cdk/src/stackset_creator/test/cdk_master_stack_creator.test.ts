import { expect as expectCDK, matchTemplate, MatchStyle } from '@aws-cdk/assert';
import * as cdk from '@aws-cdk/core';
import { Cdk_MasterStack_Creator } from '../lib/cdk_master_stack_creator';

test('Empty Stack', () => {
    const app = new cdk.App();
    // WHEN
    const stack = Cdk_MasterStack_Creator(app, 'MyTestMasterStack', 
    {
      environmentFriendlyName: "Build Test Environment",
      environmentType: "test",
      description: "this is just a test master stack",
      masterStackName: "TestMasterStack",
      nestedStacks: [],
      projectFriendlyName: "My test project"
    });

    // THEN
    expectCDK(stack).to(matchTemplate({
      "Resources": {}
    }, MatchStyle.EXACT))
});
