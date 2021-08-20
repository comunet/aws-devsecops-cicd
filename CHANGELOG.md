# Changelog

All notable changes to this project will be documented in this file.

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
