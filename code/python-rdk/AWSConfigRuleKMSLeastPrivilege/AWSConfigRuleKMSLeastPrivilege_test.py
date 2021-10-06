import unittest

try:
    from unittest.mock import MagicMock, patch, ANY
except ImportError:
    import mock
    from mock import MagicMock, patch, ANY
import botocore
from botocore.exceptions import ClientError
import sys
import os
import json
import logging

# Define the default resource to report to Config Rules
DEFAULT_RESOURCE_TYPE = 'AWS::KMS::Key'

CONFIG_CLIENT_MOCK = MagicMock()
STS_CLIENT_MOCK = MagicMock()
KMS_CLIENT_MOCK = MagicMock()


class Boto3Mock:
    def client(self, client_name, *args, **kwargs):
        if client_name == "config":
            return CONFIG_CLIENT_MOCK
        elif client_name == "sts":
            return STS_CLIENT_MOCK
        elif client_name == "kms":
            return KMS_CLIENT_MOCK
        else:
            raise Exception("Attempting to create an unknown client")


sys.modules["boto3"] = Boto3Mock()

import AWSConfigRuleKMSLeastPrivilege as rule

class TestKMSKeyPolicy(unittest.TestCase):
    list_aliases = {
        "Aliases": [
            {
                "AliasName": "alias/testkey",
                "AliasArn": "arn:aws:kms:us-east-1:111122223333:alias/testkey",
                "TargetKeyId": "000041d6-1111-2222-3333-4444560c5555",
            }
        ]
    }

    def setUp(self):
        CONFIG_CLIENT_MOCK.reset_mock()
        KMS_CLIENT_MOCK.reset_mock()

    # scenario 1
    def test_is_not_cmk(self):
        ruleParam = (
            "{\"CMKWhitelist\" : \"\", \"PrincipalWhitelist\" : \"\"}"
        )
        KMS_CLIENT_MOCK.list_aliases = MagicMock(return_value=self.list_aliases)
        KMS_CLIENT_MOCK.describe_key = MagicMock(
            return_value={
                "KeyMetadata": {
                    "KeyId": "000041d6-1111-2222-3333-4444560c5555",
                    "KeyManager": "AWS",
                }
            }
        )
        lambda_event = build_lambda_scheduled_event(rule_parameters=ruleParam)
        response = rule.lambda_handler(lambda_event, {})
        resp_expected = []
        resp_expected.append(
            build_expected_response(
                'NOT_APPLICABLE', 'alias/testkey', annotation='KMS is not a CMK'
            )
        )
        assert_successful_evaluation(self, response, resp_expected)

    def test_is_not_disabled(self):
        ruleParam = (
            "{\"CMKWhitelist\" : \"\", \"PrincipalWhitelist\" : \"\"}"
        )
        KMS_CLIENT_MOCK.list_aliases = MagicMock(return_value=self.list_aliases)
        KMS_CLIENT_MOCK.describe_key = MagicMock(
            return_value={
                "KeyMetadata": {
                    "KeyId": "000041d6-1111-2222-3333-4444560c5555",
                    "KeyManager": "CUSTOMER",
                    "Enabled": False,
                }
            }
        )
        lambda_event = build_lambda_scheduled_event(rule_parameters=ruleParam)
        response = rule.lambda_handler(lambda_event, {})
        resp_expected = []
        resp_expected.append(
            build_expected_response(
                'NOT_APPLICABLE',
                'alias/testkey',
                annotation='CMK alias/testkey is disabled',
            )
        )
        assert_successful_evaluation(self, response, resp_expected)


    def test_cmk_in_whitelist(self):
        ruleParam = (
            "{\"CMKWhitelist\" : \"test*\", \"PrincipalWhitelist\" : \"\"}"
        )
        KMS_CLIENT_MOCK.list_aliases = MagicMock(
            return_value={
                "Aliases": [
                    {
                        "AliasName": "alias/test",
                        "AliasArn": "arn:aws:kms:us-east-1:012345678900:alias/testkey",
                        "TargetKeyId": "000041d6-1111-2222-3333-4444560c5555",
                    }
                ]
            }
        )
        lambda_event = build_lambda_scheduled_event(rule_parameters=ruleParam)
        response = rule.lambda_handler(lambda_event, {})
        resp_expected = []
        resp_expected.append(
            build_expected_response(
                'COMPLIANT',
                'alias/test',
                annotation='CMK alias/test is in whitelist for CMK Key Policy check',
            )
        )
        assert_successful_evaluation(self, response, resp_expected)

    def test_princial_not_set_to_wildcard(self):
        
        ruleParam = (
            "{\"CMKWhitelist\" : \"\", \"PrincipalWhitelist\" : \"\"}"
        )
        KMS_CLIENT_MOCK.list_aliases = MagicMock(return_value=self.list_aliases)
        KMS_CLIENT_MOCK.describe_key = MagicMock(
            return_value={
                "KeyMetadata": {
                    "KeyId": "000041d6-1111-2222-3333-4444560c5555",
                    "KeyManager": "CUSTOMER",
                    "Enabled": True,
                }
            }
        )
        policy_doc = build_policy_doc(actions="kms:Encrypt", principal = ["*"])
        policy_response = build_policy_response(policy_doc)
        KMS_CLIENT_MOCK.get_key_policy = MagicMock(return_value=policy_response)
        lambda_event = build_lambda_scheduled_event(rule_parameters=ruleParam)
        response = rule.lambda_handler(lambda_event, {})
        resp_expected = []
        resp_expected.append(
            build_expected_response(
                'NON_COMPLIANT',
                'alias/testkey',
                annotation='In Key Policy for alias/testkey, principal is set to * allowing full access to all users',
            )
        )
        assert_successful_evaluation(self, response, resp_expected)


    def test_ignore_root_account_if_by_self(self):
        ruleParam = (
            "{\"CMKWhitelist\" : \"\", \"PrincipalWhitelist\" : \"\"}"
        )
        KMS_CLIENT_MOCK.list_aliases = MagicMock(return_value=self.list_aliases)
        KMS_CLIENT_MOCK.describe_key = MagicMock(
            return_value={
                "KeyMetadata": {
                    "KeyId": "000041d6-1111-2222-3333-4444560c5555",
                    "KeyManager": "CUSTOMER",
                    "Enabled": True,
                }
            }
        )
        policy_doc = build_policy_doc(actions="kms:*", principal = ["arn:aws:iam::111122223333:root"])
        policy_response = build_policy_response(policy_doc)
        KMS_CLIENT_MOCK.get_key_policy = MagicMock(return_value=policy_response)
        lambda_event = build_lambda_scheduled_event(rule_parameters=ruleParam)
        response = rule.lambda_handler(lambda_event, {})
        resp_expected = []
        resp_expected.append(
            build_expected_response(
                'COMPLIANT',
                'alias/testkey',
                annotation='In Key Policy for alias/testkey, statement has valid rules',
            )
        )
        assert_successful_evaluation(self, response, resp_expected)
        
    def test_do_not_ignore_root_account_if_not_by_self(self):
        ruleParam = (
            "{\"CMKWhitelist\" : \"\", \"PrincipalWhitelist\" : \"\"}"
        )
        KMS_CLIENT_MOCK.list_aliases = MagicMock(return_value=self.list_aliases)
        KMS_CLIENT_MOCK.describe_key = MagicMock(
            return_value={
                "KeyMetadata": {
                    "KeyId": "000041d6-1111-2222-3333-4444560c5555",
                    "KeyManager": "CUSTOMER",
                    "Enabled": True,
                }
            }
        )
        policy_doc = build_policy_doc(actions="kms:*", principal = ["arn:aws:iam::111122223333:root", "arn:aws:iam::111122223333:user/test"])
        policy_response = build_policy_response(policy_doc)
        KMS_CLIENT_MOCK.get_key_policy = MagicMock(return_value=policy_response)
        lambda_event = build_lambda_scheduled_event(rule_parameters=ruleParam)
        response = rule.lambda_handler(lambda_event, {})
        resp_expected = []
        resp_expected.append(
            build_expected_response(
                'NON_COMPLIANT',
                'alias/testkey',
                annotation='In Key Policy for alias/testkey, statement has access to kms:* for non root principal',
            )
        )
        assert_successful_evaluation(self, response, resp_expected)
        
    def test_do_not_permit_kms_star(self):
        ruleParam = (
            "{\"CMKWhitelist\" : \"\", \"PrincipalWhitelist\" : \"\"}"
        )
        KMS_CLIENT_MOCK.list_aliases = MagicMock(return_value=self.list_aliases)
        KMS_CLIENT_MOCK.describe_key = MagicMock(
            return_value={
                "KeyMetadata": {
                    "KeyId": "000041d6-1111-2222-3333-4444560c5555",
                    "KeyManager": "CUSTOMER",
                    "Enabled": True,
                }
            }
        )
        policy_doc = build_policy_doc(actions="kms:*")
        policy_response = build_policy_response(policy_doc)
        KMS_CLIENT_MOCK.get_key_policy = MagicMock(return_value=policy_response)
        lambda_event = build_lambda_scheduled_event(rule_parameters=ruleParam)
        response = rule.lambda_handler(lambda_event, {})
        resp_expected = []
        resp_expected.append(
            build_expected_response(
                'NON_COMPLIANT',
                'alias/testkey',
                annotation='In Key Policy for alias/testkey, statement has access to kms:* for non root principal',
            )
        )
        assert_successful_evaluation(self, response, resp_expected)

    def test_do_not_permit_encypt_and_manage(self):
        ruleParam = (
            "{\"CMKWhitelist\" : \"\", \"PrincipalWhitelist\" : \"\"}"
        )
        KMS_CLIENT_MOCK.list_aliases = MagicMock(return_value=self.list_aliases)
        KMS_CLIENT_MOCK.describe_key = MagicMock(
            return_value={
                "KeyMetadata": {
                    "KeyId": "000041d6-1111-2222-3333-4444560c5555",
                    "KeyManager": "CUSTOMER",
                    "Enabled": True,
                }
            }
        )
        policy_doc = build_policy_doc(
            actions=["kms:Encrypt", "kms:Create*", "kms:Delete*", "kms:Put*"],
            principal = ["arn:aws:iam::111122223333:user/test"],
        )
        policy_response = build_policy_response(policy_doc)
        KMS_CLIENT_MOCK.get_key_policy = MagicMock(return_value=policy_response)
        lambda_event = build_lambda_scheduled_event(rule_parameters=ruleParam)
        response = rule.lambda_handler(lambda_event, {})
        resp_expected = []
        resp_expected.append(
            build_expected_response(
                'NON_COMPLIANT',
                'alias/testkey',
                annotation='In Key Policy for alias/testkey, statement allows for both management and encryption voilating separation of duties',
            )
        )
        assert_successful_evaluation(self, response, resp_expected)
        
    def test_permit_encypt_and_manage_if_whitelisted(self):
        ruleParam = (
            "{\"CMKWhitelist\" : \"\", \"PrincipalWhitelist\" : \"user/test\"}"
        )
        KMS_CLIENT_MOCK.list_aliases = MagicMock(return_value=self.list_aliases)
        KMS_CLIENT_MOCK.describe_key = MagicMock(
            return_value={
                "KeyMetadata": {
                    "KeyId": "000041d6-1111-2222-3333-4444560c5555",
                    "KeyManager": "CUSTOMER",
                    "Enabled": True,
                }
            }
        )
        policy_doc = build_policy_doc(
            actions=["kms:Encrypt", "kms:Create*", "kms:Delete*", "kms:Put*"],
            principal = ["arn:aws:iam::111122223333:user/test"],
        )
        policy_response = build_policy_response(policy_doc)
        KMS_CLIENT_MOCK.get_key_policy = MagicMock(return_value=policy_response)
        lambda_event = build_lambda_scheduled_event(rule_parameters=ruleParam)
        response = rule.lambda_handler(lambda_event, {})
        resp_expected = []
        resp_expected.append(
            build_expected_response(
                'COMPLIANT',
                'alias/testkey',
                annotation='In Key Policy for alias/testkey, statement has valid rules',
            )
        )
        assert_successful_evaluation(self, response, resp_expected)

    def test_non_array_principal(self):
        ruleParam = (
            "{\"CMKWhitelist\" : \"\", \"PrincipalWhitelist\" : \"\"}"
        )
        KMS_CLIENT_MOCK.list_aliases = MagicMock(return_value=self.list_aliases)
        KMS_CLIENT_MOCK.describe_key = MagicMock(
            return_value={
                "KeyMetadata": {
                    "KeyId": "000041d6-1111-2222-3333-4444560c5555",
                    "KeyManager": "CUSTOMER",
                    "Enabled": True,
                }
            }
        )
        policy_doc = build_policy_doc(actions="kms:*", principal = "arn:aws:iam::111122223333:root")
        policy_response = build_policy_response(policy_doc)
        KMS_CLIENT_MOCK.get_key_policy = MagicMock(return_value=policy_response)
        lambda_event = build_lambda_scheduled_event(rule_parameters=ruleParam)
        response = rule.lambda_handler(lambda_event, {})
        resp_expected = []
        resp_expected.append(
            build_expected_response(
                'COMPLIANT',
                'alias/testkey',
                annotation='In Key Policy for alias/testkey, statement has valid rules',
            )
        )
        assert_successful_evaluation(self, response, resp_expected)

####################
# Helper Functions #
####################

def build_lambda_configurationchange_event(invoking_event, rule_parameters=None):
    event_to_return = {
        'configRuleName':'myrule',
        'executionRoleArn':'roleArn',
        'eventLeftScope': False,
        'invokingEvent': invoking_event,
        'accountId': '123456789012',
        'configRuleArn': 'arn:aws:config:us-east-1:123456789012:config-rule/config-rule-8fngan',
        'resultToken':'token'
    }
    if rule_parameters:
        event_to_return['ruleParameters'] = rule_parameters
    return event_to_return

def build_lambda_scheduled_event(rule_parameters=None):
    invoking_event = '{"messageType":"ScheduledNotification","notificationCreationTime":"2017-12-23T22:11:18.158Z"}'
    event_to_return = {
        'configRuleName':'myrule',
        'executionRoleArn':'roleArn',
        'eventLeftScope': False,
        'invokingEvent': invoking_event,
        'accountId': '123456789012',
        'configRuleArn': 'arn:aws:config:us-east-1:123456789012:config-rule/config-rule-8fngan',
        'resultToken':'token'
    }
    if rule_parameters:
        event_to_return['ruleParameters'] = rule_parameters
    return event_to_return

def build_expected_response(compliance_type, compliance_resource_id, compliance_resource_type=DEFAULT_RESOURCE_TYPE, annotation=None):
    if not annotation:
        return {
            'ComplianceType': compliance_type,
            'ComplianceResourceId': compliance_resource_id,
            'ComplianceResourceType': compliance_resource_type
            }
    return {
        'ComplianceType': compliance_type,
        'ComplianceResourceId': compliance_resource_id,
        'ComplianceResourceType': compliance_resource_type,
        'Annotation': annotation
        }

def assert_successful_evaluation(test_class, response, resp_expected, evaluations_count=1):
    if isinstance(response, dict):
        test_class.assertEquals(resp_expected['ComplianceResourceType'], response['ComplianceResourceType'])
        test_class.assertEquals(resp_expected['ComplianceResourceId'], response['ComplianceResourceId'])
        test_class.assertEquals(resp_expected['ComplianceType'], response['ComplianceType'])
        test_class.assertTrue(response['OrderingTimestamp'])
        if 'Annotation' in resp_expected or 'Annotation' in response:
            test_class.assertEquals(resp_expected['Annotation'], response['Annotation'])
    elif isinstance(response, list):
        test_class.assertEquals(evaluations_count, len(response))
        for i, response_expected in enumerate(resp_expected):
            test_class.assertEquals(response_expected['ComplianceResourceType'], response[i]['ComplianceResourceType'])
            test_class.assertEquals(response_expected['ComplianceResourceId'], response[i]['ComplianceResourceId'])
            test_class.assertEquals(response_expected['ComplianceType'], response[i]['ComplianceType'])
            test_class.assertTrue(response[i]['OrderingTimestamp'])
            if 'Annotation' in response_expected or 'Annotation' in response[i]:
                test_class.assertEquals(response_expected['Annotation'], response[i]['Annotation'])

def assert_customer_error_response(test_class, response, customer_error_code=None, customer_error_message=None):
    if customer_error_code:
        test_class.assertEqual(customer_error_code, response['customerErrorCode'])
    if customer_error_message:
        test_class.assertEqual(customer_error_message, response['customerErrorMessage'])
    test_class.assertTrue(response['customerErrorCode'])
    test_class.assertTrue(response['customerErrorMessage'])
    if "internalErrorMessage" in response:
        test_class.assertTrue(response['internalErrorMessage'])
    if "internalErrorDetails" in response:
        test_class.assertTrue(response['internalErrorDetails'])

def sts_mock():
    assume_role_response = {
        "Credentials": {
            "AccessKeyId": "string",
            "SecretAccessKey": "string",
            "SessionToken": "string"}}
    STS_CLIENT_MOCK.reset_mock(return_value=True)
    STS_CLIENT_MOCK.assume_role = MagicMock(return_value=assume_role_response)

##################
# Common Testing #
##################

class TestStsErrors(unittest.TestCase):

    def test_sts_unknown_error(self):
        rule.ASSUME_ROLE_MODE = True
        rule.evaluate_parameters = MagicMock(return_value=True)
        STS_CLIENT_MOCK.assume_role = MagicMock(side_effect=botocore.exceptions.ClientError(
            {'Error': {'Code': 'unknown-code', 'Message': 'unknown-message'}}, 'operation'))
        response = rule.lambda_handler(build_lambda_configurationchange_event('{}'), {})
        assert_customer_error_response(
            self, response, 'InternalError', 'InternalError')

    def test_sts_access_denied(self):
        rule.ASSUME_ROLE_MODE = True
        rule.evaluate_parameters = MagicMock(return_value=True)
        STS_CLIENT_MOCK.assume_role = MagicMock(side_effect=botocore.exceptions.ClientError(
            {'Error': {'Code': 'AccessDenied', 'Message': 'access-denied'}}, 'operation'))
        response = rule.lambda_handler(build_lambda_configurationchange_event('{}'), {})
        assert_customer_error_response(
            self, response, 'AccessDenied', 'AWS Config does not have permission to assume the IAM role.')

def build_policy_doc(actions=["kms:*"], principal=[ "*" ], has_condition = False):
    policy = {
        "Id": "key-consolepolicy-3",
        "Version": "2012-10-17",
        "Statement": [
            {
                "Sid": "test",
                "Effect": "Allow",
                "Principal": {
                    "AWS": principal
                },
                "Action": actions,
                "Resource": "*"
            }
        ]
    }

    return json.dumps(policy)

def build_policy_response(policy):

    return {
        "Policy": policy
    }