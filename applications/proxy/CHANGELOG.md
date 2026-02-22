# @sideline/proxy

## 0.2.4

### Patch Changes

- [`79f2e9e`](https://github.com/maxa-ondrej/sideline/commit/79f2e9e7271e5ab82acdcff1b72f2e2a3b77f59f) Thanks [@maxa-ondrej](https://github.com/maxa-ondrej)! - Fix Docker build: add BuildKit setup and version-based image tags

## 0.2.3

### Patch Changes

- [`e1389ba`](https://github.com/maxa-ondrej/sideline/commit/e1389ba855a70a285581639d349908570456659c) Thanks [@maxa-ondrej](https://github.com/maxa-ondrej)! - Build and push Docker images for changed applications as part of the release workflow

## 0.2.2

### Patch Changes

- [`8505070`](https://github.com/maxa-ondrej/sideline/commit/850507079ac8e4a9846a34fc365b2c2714ecfa5b) Thanks [@maxa-ondrej](https://github.com/maxa-ondrej)! - Enable changesets versioning and tagging for private application packages

## 0.2.1

### Patch Changes

- [`db26bc9`](https://github.com/maxa-ondrej/sideline/commit/db26bc9b397f7cd00c866aa7b25873f1528384dd) Thanks [@maxa-ondrej](https://github.com/maxa-ondrej)! - Move proxy from .docker/proxy to applications/proxy, replace snapshot workflow with a unified publish workflow that routes npm publishing for packages and Docker builds for applications based on the tagged package name, and separate release PR creation from publishing in the release workflow
