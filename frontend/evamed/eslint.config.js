// @ts-check
const eslint = require("@eslint/js");
const tseslint = require("typescript-eslint");
const angular = require("angular-eslint");
const preferArrow = require("eslint-plugin-prefer-arrow");
const prettier = require("eslint-config-prettier");

module.exports = tseslint.config(
  {
    ignores: [".angular/**"],
  },
  {
    files: ["**/*.ts"],
    extends: [
      eslint.configs.recommended,
      ...tseslint.configs.recommended,
      ...tseslint.configs.stylistic,
      ...angular.configs.tsRecommended,
      prettier
    ],
    processor: angular.processInlineTemplates,
    plugins: {
      preferArrow: preferArrow
    },
    rules: {
      "@angular-eslint/directive-selector": [
        "error",
        {
          type: "attribute",
          prefix: "app",
          style: "camelCase",
        },
      ],
      "@angular-eslint/component-selector": [
        "error",
        {
          type: "element",
          prefix: "app",
          style: "kebab-case",
        },
      ],
      "no-multi-spaces": [
        "error", {
          ignoreEOLComments: true
        }
      ],
      "@typescript-eslint/no-empty-function": "off",
      "@angular-eslint/no-empty-lifecycle-method": "off",
      "@typescript-eslint/no-explicit-any": "off",
      "arrow-parens": [
        "error", "as-needed"
      ],
      "space-infix-ops": "error",
      "brace-style": [
        "error",
        "1tbs",
        { "allowSingleLine": true }
      ],
      "space-before-blocks": "error",
      "space-before-function-paren": [
        "error", {
          "named": "never",
          "anonymous": "never",
          "asyncArrow": "always"
        }
      ],
      "comma-spacing": [
        "error", {
          "before": false, "after": true
        }
      ],
      "key-spacing": [
        "error", {
          "afterColon": true
        }
      ],
      "one-var": [
        "error", "consecutive"
      ],
      "no-trailing-spaces": "error",
      "preferArrow/prefer-arrow-functions": [
        "error", {
          "allowStandaloneDeclarations": true,
          "disallowPrototype": true,
          "singleReturnOnly": false,
          "classPropertiesAllowed": false
        }
      ]
    },
  },
  {
    files: ["**/*.js"],
    plugins: {
      preferArrow: preferArrow
    },
    rules: {
      "no-multi-spaces": [
        "error", {
          ignoreEOLComments: true
        }
      ],
      "arrow-parens": [
        "error", "as-needed"
      ],
      "space-infix-ops": "error",
      "brace-style": [
        "error",
        "1tbs",
        { "allowSingleLine": true }
      ],
      "space-before-blocks": "error",
      "space-before-function-paren": [
        "error", {
          "named": "never",
          "anonymous": "never",
          "asyncArrow": "always"
        }
      ],
      "comma-spacing": [
        "error", {
          "before": false, "after": true
        }
      ],
      "key-spacing": [
        "error", {
          "afterColon": true
        }
      ],
      "no-trailing-spaces": "error",
      "preferArrow/prefer-arrow-functions": [
        "error", {
          "allowStandaloneDeclarations": true,
          "disallowPrototype": true,
          "singleReturnOnly": false,
          "classPropertiesAllowed": false
        }
      ]
    }
  },
  {
    files: ["**/*.html"],
    extends: [
      ...angular.configs.templateRecommended,
      ...angular.configs.templateAccessibility,
    ],
    rules: {},
  }
);
