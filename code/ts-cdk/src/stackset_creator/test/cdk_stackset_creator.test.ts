import { expect as expectCDK, matchTemplate, MatchStyle } from '@aws-cdk/assert';
import * as cdk from '@aws-cdk/core';
import { Cdk_StackSet_Creator } from '../lib/cdk_stackset_creator';

test('Empty Stack', () => {
    const app = new cdk.App();
    // WHEN
    const stack = Cdk_StackSet_Creator(app, 'MyTestStack',
    {
      stackSetName: "test",
      stackDescription: "this is just a test stack",
      stackSetTemplateFile: "Test.yaml",
      environmentFriendlyName: "Build Test Environment",
      projectFriendlyName: "My test project",
      environmentType: "test"
    });
    // THEN
    expectCDK(stack).to(matchTemplate({
      "Resources": {}
    }, MatchStyle.EXACT))
});