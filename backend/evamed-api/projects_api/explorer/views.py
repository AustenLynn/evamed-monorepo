"""Explorador de recursos: read-only catalogue endpoints (HANDOFF §5)."""
from collections import Counter

from rest_framework.exceptions import NotFound, ValidationError
from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response
from rest_framework.views import APIView

from projects_api import access
from projects_api.explorer import derive, queries

# stage → (items loader, {query param: item field}, {facet name: query param}).
STAGES = {
    'produccion': (queries.production_items, {'source': 'source'}, {'sources': 'source'}),
    'construccion': (queries.construction_items, {'type': 'type'}, {'types': 'type'}),
    'uso': (queries.use_items, {'source': 'source', 'type': 'type'}, {'sources': 'source', 'types': 'type'}),
    'fin-de-vida': (queries.end_of_life_items, {}, {}),
}


class ExplorerPagination(PageNumberPagination):
    # Divisible by 2, 3 and 4 columns, so card rows fill (HANDOFF §4).
    page_size = 24
    page_size_query_param = 'page_size'
    max_page_size = 100


def _filtered(items, request, filters, skip=None):
    search = request.query_params.get('search', '').strip()
    if search:
        items = [item for item in items if derive.matches(
            ' '.join(filter(None, (item['name'], item['display_name'], item['description']))), search)]
    for param, field in filters.items():
        wanted = request.query_params.getlist(param)
        if wanted and param != skip:
            items = [item for item in items if item[field] in wanted]
    return items


def _facets(items, request, filters, facets):
    """Counts per value, each ignoring its own filter so the other options stay visible."""
    result = {}
    for name, param in facets.items():
        counts = Counter(item[filters[param]] for item in _filtered(items, request, filters, skip=param))
        counts.pop(None, None)
        result[name] = dict(sorted(counts.items(), key=lambda pair: (-pair[1], derive.sort_key(pair[0]))))
    return result


class ExplorerListView(APIView):
    """GET /explorer/<stage>/?search=&source=&type=&sort=&page=&page_size="""
    permission_classes = (access.IsAdminOrReadOnly,)

    def get(self, request, stage):
        if stage not in STAGES:
            raise NotFound('Etapa desconocida.')
        sort = request.query_params.get('sort', 'nombre')
        if sort not in queries.SORTS:
            raise ValidationError({'sort': 'Usa uno de: %s.' % ', '.join(queries.SORTS)})
        load, filters, facets = STAGES[stage]
        items = load()
        paginator = ExplorerPagination()
        page = paginator.paginate_queryset(
            queries.ordered(_filtered(items, request, filters), sort, population=items), request, view=self)
        response = paginator.get_paginated_response(page)
        response.data['facets'] = _facets(items, request, filters, facets)
        return response


class ExplorerMaterialDetailView(APIView):
    """GET /explorer/produccion/<id>/"""
    permission_classes = (access.IsAdminOrReadOnly,)

    def get(self, request, pk):
        detail = queries.material_detail(pk)
        if detail is None:
            raise NotFound('Material no encontrado.')
        return Response(detail)
