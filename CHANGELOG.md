# Changelog

All notable changes to this project will be documented in this file.

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