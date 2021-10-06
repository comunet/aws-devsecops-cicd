import boto3
import json
from urllib.parse import unquote
from fnmatch import fnmatch


class AWSConfigRuleKMSStatementProcessor(object):
    def __init__(self, policy):
        self.dvdoc = json.loads(policy)
        # if the statement is a plain dict, force it into a list.
        statement = self.dvdoc['Statement']
        if type(statement) is dict:
            self.dvdoc['Statement'] = [statement]

        # force everything into lists
        for stmt in statement:
            if "AWS" in stmt["Principal"] and type(stmt["Principal"]["AWS"]) is str:
                stmt["Principal"]["AWS"] = [stmt["Principal"]["AWS"]]
                
            if type(stmt["Action"]) is str:
                stmt["Action"] = [stmt["Action"]]

    # returns an object with compliance_type and annotation parameters
    def process(self, alias, account_number, rule_parameters):
        result = {}
        # start out valid, and we will mark not in the logic below
        result['compliance_type'] = 'COMPLIANT'
        result['annotation'] = "In Key Policy for {}, statement has valid rules".format(
            alias
        )

        # iterate over each statement
        for stmt in self.dvdoc['Statement']:
            # ignore anything with a deny, we do not care
            if stmt['Effect'] == 'Deny':
                continue
            else:
                if "AWS" not in stmt["Principal"]:
                    continue

                # Iterate over the principals
                for principal in stmt["Principal"]["AWS"]:
                    # If it is the root then skip this check (root can do everything)
                    if (principal == "arn:aws:iam::" + account_number + ":root"):
                        continue

                    if (self.filterUsers(principal, rule_parameters["PrincipalWhitelist"])):
                        continue

                    # If you are not the root, then you can't have kms:*
                    if ("kms:*" in stmt["Action"]):
                        result['compliance_type'] = 'NON_COMPLIANT'
                        result['annotation'] = "In Key Policy for {}, statement has access to kms:* for non root principal".format(
                            alias
                        )
                        break

                    if (principal == "*"):
                        result['compliance_type'] = 'NON_COMPLIANT'
                        result['annotation'] = "In Key Policy for {}, principal is set to * allowing full access to all users".format(
                            alias
                        )
                        break

                    if (("kms:Encrypt" in stmt["Action"] or
                        "kms:Decrypt" in stmt["Action"] or
                        "kms:ReEncrypt" in stmt["Action"]) and 
                        ("kms:Create" in ''.join(stmt["Action"]) or
                        "kms:Delete" in ''.join(stmt["Action"]) or
                        "kms:Put" in ''.join(stmt["Action"]))):
                        result['compliance_type'] = 'NON_COMPLIANT'
                        result['annotation'] = "In Key Policy for {}, statement allows for both management and encryption voilating separation of duties".format(
                            alias
                        )
                        break

        return result

    def filterUsers(self, user, whitelist):
        if (whitelist == ""):
            return False

        parts = whitelist.split(",")

        for p in parts:
            if (p in user):
                return True

        return False
