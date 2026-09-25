variable "region" {
  description = "AWS region for Lightsail."
  type        = string
  default     = "us-east-1"
}

variable "hosted_zone_name" {
  description = "Existing public Route 53 zone, e.g. example.com"
  type        = string
}

variable "domain_name" {
  description = "Hostname for the dev environment, e.g. dev.example.com"
  type        = string

  validation {
    condition     = endswith(var.domain_name, ".${var.hosted_zone_name}")
    error_message = "domain_name must be a subdomain of hosted_zone_name."
  }
}

variable "bundle_id" {
  description = "Lightsail bundle. small_3_0 = 2 GB RAM (needed to build Angular on the box)."
  type        = string
  default     = "small_3_0"
}

variable "blueprint_id" {
  description = "Lightsail OS image."
  type        = string
  default     = "ubuntu_24_04"
}

variable "ssh_public_key_path" {
  description = "Public key installed for the ubuntu user. The private key never leaves your machine."
  type        = string
  default     = "~/.ssh/id_ed25519.pub"
}

variable "ssh_allowed_cidrs" {
  description = "CIDRs allowed to reach port 22, e.g. [\"203.0.113.7/32\"]."
  type        = list(string)

  validation {
    condition     = !contains(var.ssh_allowed_cidrs, "0.0.0.0/0")
    error_message = "Do not open SSH to the whole internet."
  }
}

variable "github_repository" {
  description = "owner/name of the repo whose `dev` environment may deploy."
  type        = string
  default     = "AustenLynn/evamed-monorepo"
}
