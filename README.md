# PBJS

Creates closure goog.proto2.Message .pb.js source code from .proto files.

### Maturity

Supports type checking, though it uses the js number type for 64bit numbers.

Does not support extensions, custom options, or services.

### Install dependencies:

`npm install`

### Run tests:

`npm test`
`npm run-script tdd`

### TODO
- detect circular imports
- add @jsnamespace directive
- check handing of default field values that are enums...
- ensure goog.proto2.FieldDescriptor.FieldType, rather than
  goog.proto2.Message.FieldType
- protoc cli compatibility
- node getter/setter output
