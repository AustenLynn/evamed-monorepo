# Page dependencies
## Construction new
- frontend/evamed/src/app/construction-stage/components/construction-stage/construction-stage.component.ts
  - frontend/evamed/src/app/core/services/catalogs/catalogs.service.ts
    - frontend/evamed/src/environments/environment.ts
  - frontend/evamed/src/app/core/services/materials/materials.service.ts
    - frontend/evamed/src/environments/environment.ts
    - frontend/evamed/src/app/core/services/catalogue-cache/catalogue-cache.service.ts
  - frontend/evamed/src/app/shared/building-sections.ts
  - frontend/evamed/src/app/construction-stage/components/construction-stage/construction-stage.component.html
  - frontend/evamed/src/app/construction-stage/components/construction-stage/construction-stage.component.scss

## Construction existing
- frontend/evamed/src/app/construction-stage/components/construction-stage-update/construction-stage-update.component.ts
  - frontend/evamed/src/app/core/services/catalogs/catalogs.service.ts
    - frontend/evamed/src/environments/environment.ts
  - frontend/evamed/src/app/core/services/selection/selection.service.ts
  - frontend/evamed/src/app/construction-stage/components/construction-stage-update/construction-stage-update.component.html
  - frontend/evamed/src/app/construction-stage/components/construction-stage-update/construction-stage-update.component.scss

## End life new
- frontend/evamed/src/app/end-life-stage/components/end-life-stage/end-life-stage.component.ts
  - frontend/evamed/src/app/core/services/end-life/end-life.service.ts
    - frontend/evamed/src/environments/environment.ts
  - frontend/evamed/src/app/end-life-stage/components/intermedial/intermedial.component.ts
    - frontend/evamed/src/app/core/services/materials/materials.service.ts
      - frontend/evamed/src/environments/environment.ts
      - frontend/evamed/src/app/core/services/catalogue-cache/catalogue-cache.service.ts
    - frontend/evamed/src/app/end-life-stage/components/intermedial/intermedial.component.html
    - frontend/evamed/src/app/end-life-stage/components/intermedial/intermedial.component.scss
  - frontend/evamed/src/app/shared/building-sections.ts
  - frontend/evamed/src/app/end-life-stage/components/end-life-stage/end-life-stage.component.html
  - frontend/evamed/src/app/end-life-stage/components/end-life-stage/end-life-stage.component.scss

## End life existing
- frontend/evamed/src/app/end-life-stage/components/end-life-update/end-life-update.component.ts
  - frontend/evamed/src/app/core/services/selection/selection.service.ts
  - frontend/evamed/src/app/end-life-stage/components/end-life-update/end-life-update.component.html
  - frontend/evamed/src/app/end-life-stage/components/end-life-update/end-life-update.component.scss

## Materials existing
- frontend/evamed/src/app/materials-stage/components/material-stage-update/material-stage-update.component.ts
  - frontend/evamed/src/app/core/services/materials/materials.service.ts
    - frontend/evamed/src/environments/environment.ts
    - frontend/evamed/src/app/core/services/catalogue-cache/catalogue-cache.service.ts
  - frontend/evamed/src/app/core/services/projects/projects.service.ts
    - frontend/evamed/src/environments/environment.ts
  - frontend/evamed/src/app/core/services/selection/selection.service.ts
  - frontend/evamed/src/app/explorer/explorer-picker.service.ts
    - frontend/evamed/src/app/explorer/explorer.models.ts
      - frontend/evamed/src/app/explorer/stage-config.ts
    - frontend/evamed/src/app/explorer/picker.models.ts
    - frontend/evamed/src/app/explorer/components/explorer-picker/explorer-picker.component.ts
      - frontend/evamed/src/app/explorer/explorer.models.ts
      - frontend/evamed/src/app/explorer/picker.models.ts
      - frontend/evamed/src/app/explorer/services/explorer.service.ts
        - frontend/evamed/src/environments/environment.ts
        - frontend/evamed/src/app/explorer/explorer.models.ts
        - frontend/evamed/src/app/explorer/stage-config.ts
        - frontend/evamed/src/app/explorer/services/explorer-feed.ts
          - frontend/evamed/src/app/explorer/explorer.models.ts
      - frontend/evamed/src/app/explorer/stage-config.ts
      - frontend/evamed/src/app/explorer/components/explorer-browser/explorer-browser.component.ts
        - frontend/evamed/src/app/explorer/explorer.models.ts
        - frontend/evamed/src/app/explorer/services/explorer-feed.ts
        - frontend/evamed/src/app/explorer/services/explorer.service.ts
        - frontend/evamed/src/app/explorer/stage-config.ts
        - frontend/evamed/src/app/explorer/components/explorer-browser/explorer-browser.component.html
        - frontend/evamed/src/app/explorer/components/explorer-browser/explorer-browser.component.scss
      - frontend/evamed/src/app/explorer/components/explorer-picker/explorer-picker.component.html
      - frontend/evamed/src/app/explorer/components/explorer-picker/explorer-picker.component.scss
  - frontend/evamed/src/app/explorer/picker.models.ts
  - frontend/evamed/src/app/materials-stage/picked-material.ts
    - frontend/evamed/src/app/explorer/picker.models.ts
  - frontend/evamed/src/app/materials-stage/components/add-constructive-system/add-constructive-system.component.ts
    - frontend/evamed/src/app/materials-stage/components/add-constructive-system/add-constructive-system.component.html
    - frontend/evamed/src/app/materials-stage/components/add-constructive-system/add-constructive-system.component.scss
  - frontend/evamed/src/app/materials-stage/material-list.ts
  - frontend/evamed/src/app/materials-stage/components/material-stage-update/material-stage-update.component.html
  - frontend/evamed/src/app/materials-stage/components/material-stage-update/material-stage-update.component.scss

## Explorer browser
- frontend/evamed/src/app/explorer/components/explorer-browser/explorer-browser.component.ts
  - frontend/evamed/src/app/explorer/explorer.models.ts
    - frontend/evamed/src/app/explorer/stage-config.ts
  - frontend/evamed/src/app/explorer/services/explorer-feed.ts
    - frontend/evamed/src/app/explorer/explorer.models.ts
  - frontend/evamed/src/app/explorer/services/explorer.service.ts
    - frontend/evamed/src/environments/environment.ts
    - frontend/evamed/src/app/explorer/explorer.models.ts
    - frontend/evamed/src/app/explorer/stage-config.ts
    - frontend/evamed/src/app/explorer/services/explorer-feed.ts
  - frontend/evamed/src/app/explorer/stage-config.ts
  - frontend/evamed/src/app/explorer/components/explorer-browser/explorer-browser.component.html
  - frontend/evamed/src/app/explorer/components/explorer-browser/explorer-browser.component.scss