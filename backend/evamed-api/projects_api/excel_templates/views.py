"""Download of the Excel templates with the current catalogue."""
import logging

from django.http import HttpResponse
from django.utils import timezone
from rest_framework.exceptions import NotFound
from rest_framework.response import Response
from rest_framework.views import APIView

from projects_api import access
from projects_api.excel_templates import build

logger = logging.getLogger(__name__)

CONTENT_TYPE = 'application/vnd.ms-excel.sheet.macroEnabled.12'
FILENAMES = {'windows': 'Formato Windows.xlsm', 'mac': 'Formato MAC.xlsm'}


class TemplateDownloadView(APIView):
    permission_classes = (access.IsAdminOrReadOnly,)

    def get(self, request, kind):
        if kind not in build.TEMPLATES:
            raise NotFound()
        try:
            data = build.build_template(kind, build.catalogue_rows(), timezone.now())
        except build.TooManyMaterials as error:
            logger.error('Excel template %s cannot hold the catalogue: %s', kind, error)
            return Response(
                {'detail': 'El catálogo tiene más materiales de los que caben en la plantilla.'}, status=500)
        response = HttpResponse(data, content_type=CONTENT_TYPE)
        response['Content-Disposition'] = 'attachment; filename="%s"' % FILENAMES[kind]
        return response
