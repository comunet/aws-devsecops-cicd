# Changelog

All notable changes to this project will be documented in this file.

## [4.0.0] - 2022-07-27

### Added
- Solution now uses StackSet 'Delegated Admin' to manage StackSets from the Deployment Account (on behalf of the management account). This improves security (reduced need to log in to the management account) and make management of StackSets more convenient as you no longer need to keep moving between so many accounts (deployment>management>target acounts).
- Now supports `Account level targets for service-managed Stack Sets` [https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/account-level-targets.html]. You can now target Individual AWS Accounts and Org Units with various combinations using `AccountFilterType`. 
- Can now disable specific envs of a stack from deploying by setting optional variable ` env[].enabled:"false" ` in Stacks.json

### Changed
- Upgraded CodeBuild NodeJS version 14 (from v12)
- Upgraded AWS CDK to version 2 (from v1)

## [3.0.0] - 2021-10-06

### Added

- AWS Config Rules Development Kit (RDK) now integrated in DevSecOps framework - deploy custom rules to the organisation
- Added 'Default Region' to OrgUnits.json to provision resources that are 'install-once-per-account'
- Added new deployment override in Stacks.json 'overrideDeploymentRegionUseDefaultOnly' - allows deploy to default region only
- Additional setup role required for (RDK)

### Changed

- Renamed root folder '/lambda' to '/code' with inclusion of RDK and CDK frameworks (not strictly Lambda)
- CodePipeline Workflow has changed and will need to be re-deployed (re-run `/cf/setup/automated_deployment.sh`)

## [2.0.0] - 2021-08-10

### Added

- Solution now supports Targeted Multi-region, Multi-OrgUnit environments
- Amazon CDK/Typescript now used to generate Master/Nested Stacks and Automated StackSets

### Changed

- **NOTE: This version introduces Breaking Changes from v1.1.0**- There is no easy migration path for getting stacks deployed with v1.1.0 to be retained. They must be deleted and reprovisioned through the new method introduced in v2.0.0
- You no longer need a manual MasterStack or create StackSets - the tool now generated these automatically base on settings applied to config json files.
- Parameter files are replaced with config (/config) files which specify what gets deployed and where.
- A lot less effort now to hook up new templates as no longer need to pass reference parameters manually from master to nested+ templates. 
- Manual Deployment steps moved from [README.md] to separate file (/cf/setup/Manual_Deployment.md) for improved readability

## [1.1.0] - 2021-07-20

### Added

- Added trust roles for SELF-MANAGED deploy of StackSets to support targeted deployment to individual accounts (instead of just OrgUnit targets). These roles can be used by a Lambda to assume role the 'AWSCloudFormationStackSetAdministrationRole' account, to kick off a manual StackSet instance
- Changelog file

### Changed

- Updated automated deployment script
- Updated target deploy roles for working with Service Catalog
- Fixed typo in 'BuildGuid' variable

## [1.0.0] - 2021-05-27

### Added

- Initial release
