# Usage stage mockup — agreed direction and exact context

This is a new card/dialog feature in the existing Usage route, not a recreation of its old accordion form. Reuse the current Construction/Materials styles supplied as source and rendered references. The prior equipment draft is not authoritative for current inline editing.

Owner wants Usage close to other stages, Add Source via a catalogue dialog, editing inside selected source card, editable percentages with derived quantity, and keeping shares fixed when annual consumption changes. Mockup only: no app implementation or project persistence.

Main screen: actual EVAMED header, project/back link, four real round stage icons with Uso active, and existing footer. Usage is global to the building/project: NO building-element rail, no Cimentación/Muros sections or equipment wording. A compact white annual-consumption surface above cards shows 10,000 kWh/año and an Edit/Save/Cancel interaction. Include short helper copy explaining percentage preservation. Below: Fuentes de energía, Agregar fuente primary button, and an allocation summary/progress bar. Example starts with two sources: catalogue id10 electricity 60%=6000kWh/año and id11 gas 20%=2000kWh/año, total80% assigned and20%/2000kWh remaining. Label project/example appropriately; these are synthetic numbers, not existing project facts.

Cards use the current Materials-like geometry, full readable title, source/region chips, prominent annual quantity and share percentage. Keep quantities in their own role, no trailing decimal zeros, no GWP or impact badge. Aligned collapsed card sections. Each has Editar fuente and Eliminar. Clicking edit expands just that card, shows percentage input, readonly calculated annual quantity, Cambiar fuente, Guardar cambios and Cancelar. Preserve drafts on validation errors, constrain total share<=100%, and do not silently redistribute other shares. Changing annual total to12000 with60%/20% yields7200/2400 and20%=2400 remaining. Cancel restores committed state. Newly added sources start at0% and derived0. Removing a card leaves other percentages unchanged. Simulate these interactions client-side within the draft, never call application APIs.

Add Source: same bottom-sheet catalogue75dvh as current Material/Equipment menus, with fixed title/context/close, shared filter style on left (Base de datos, Tipo, Región and search), readable selectable cards, Cards/List control, persistent selection tray and Agregar selección. On mobile one column with one main scroll owner, no horizontal overflow. Selection must survive filters; sources already in main view cannot be added twice. No percentage/unit fields in batch selection. Selecting a replacement is direct, with no multi-add tray.

Photovoltaic panels are a distinct generation option, NOT a fabricated TypeEnergy catalogue entry: the current model stores source=panels,type=null and has no database/region/factor to assert. Make Paneles fotovoltaicos available as a clear special choice in the dialog, labelled Generación en sitio. Its card can receive an allocation share. Do not claim zero impact, low impact, a region, a database, or an environmental score for it. Do not invent extra energy products.

The implementation's Unit/EnergyUnit mapping and integer contracts require a later technical plan; do not expose those implementation details in product copy or pretend this mockup fixes them. Quantities/percentages use simple example math; production schema/calculations remain unchanged in this task.

Fidelity: only fonts/colours/spacing/component styles from current design-system. No dark sidebar, new branding, decorative illustrations, charts with fabricated impacts, giant hero typography or new source scores. Keep existing Material-like outlined fields, green primary fill and dark labels, readable-green text actions. Stage navigation uses supplied exact imageURLs; use exact EVAMED logo in every header/logo position and the exact footer image, never substitute initials/emoji/SVG marks/text alone. Existing saved EvamedHeader component is available with matching real logo; it may be reused.

## Catalogue examples derived from current fixture names
[
  {
    "id": 2,
    "name": "Energía eléctrica, Medio voltaje (MX)-ECOINVENT3",
    "displayName": "Energía eléctrica, Medio voltaje",
    "database": "ECOINVENT 3",
    "region": "México",
    "kind": "Electricidad"
  },
  {
    "id": 9,
    "name": "Energía eléctrica, Alto voltaje (MX)-ECOINVENT3",
    "displayName": "Energía eléctrica, Alto voltaje",
    "database": "ECOINVENT 3",
    "region": "México",
    "kind": "Electricidad"
  },
  {
    "id": 10,
    "name": "Energía eléctrica, Bajo voltaje (MX)-ECOINVENT3",
    "displayName": "Energía eléctrica, Bajo voltaje",
    "database": "ECOINVENT 3",
    "region": "México",
    "kind": "Electricidad"
  },
  {
    "id": 11,
    "name": "Calefacción doméstica con gas natural (GLO)",
    "displayName": "Calefacción doméstica con gas natural",
    "database": null,
    "region": "Global",
    "kind": "Gas"
  },
  {
    "id": 15,
    "name": "Energía eléctrica, Alto voltaje (MX)-MEXICANIUH",
    "displayName": "Energía eléctrica, Alto voltaje",
    "database": "mexicaniuh",
    "region": "México",
    "kind": "Electricidad"
  },
  {
    "id": 16,
    "name": "Energía eléctrica, Medio voltaje (MX)-MEXICANIUH",
    "displayName": "Energía eléctrica, Medio voltaje",
    "database": "mexicaniuh",
    "region": "México",
    "kind": "Electricidad"
  },
  {
    "id": 17,
    "name": "Energía eléctrica, Bajo voltaje (MX)-MEXICANIUH",
    "displayName": "Energía eléctrica, Bajo voltaje",
    "database": "mexicaniuh",
    "region": "México",
    "kind": "Electricidad"
  }
]

## Exact public identity assets
usage: https://vgbujcuwptvheqijyjbe.supabase.co/storage/v1/object/public/hmac-uploads/projects/18d030f8-69ec-49b9-99c4-d0f99287b85e/brand-assets/evamed-usage-reference-usage/Uso.png
production: https://vgbujcuwptvheqijyjbe.supabase.co/storage/v1/object/public/hmac-uploads/projects/18d030f8-69ec-49b9-99c4-d0f99287b85e/brand-assets/evamed-usage-reference-production/Produccion_.png
construction: https://vgbujcuwptvheqijyjbe.supabase.co/storage/v1/object/public/hmac-uploads/projects/18d030f8-69ec-49b9-99c4-d0f99287b85e/brand-assets/evamed-usage-reference-construction/Construcci__n_.png
end-life: https://vgbujcuwptvheqijyjbe.supabase.co/storage/v1/object/public/hmac-uploads/projects/18d030f8-69ec-49b9-99c4-d0f99287b85e/brand-assets/evamed-usage-reference-end-life/fin.png
footer: https://vgbujcuwptvheqijyjbe.supabase.co/storage/v1/object/public/hmac-uploads/projects/18d030f8-69ec-49b9-99c4-d0f99287b85e/brand-assets/evamed-usage-reference-footer/DAUIC_Horizontal_Color.jpg
logo: https://vgbujcuwptvheqijyjbe.supabase.co/storage/v1/object/public/hmac-uploads/projects/18d030f8-69ec-49b9-99c4-d0f99287b85e/brand-assets/frontend-evamed-src-assets-relevants-logo.png/logo.png

The two screenshot references show actual current equipment card/menu styling with synthetic local data; use their design language for Usage rather than their equipment-specific copy.
