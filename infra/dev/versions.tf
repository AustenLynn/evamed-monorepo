terraform {
  required_version = ">= 1.10"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.0"
    }
  }

  # bucket/region come from backend.hcl (written by ../bootstrap-state.sh).
  # use_lockfile = S3-native state locking; no DynamoDB table needed.
  backend "s3" {
    key          = "evamed/dev/terraform.tfstate"
    encrypt      = true
    use_lockfile = true
  }
}

provider "aws" {
  region = var.region

  default_tags {
    tags = {
      Project     = "evamed"
      Environment = "dev"
      ManagedBy   = "terraform"
    }
  }
}
