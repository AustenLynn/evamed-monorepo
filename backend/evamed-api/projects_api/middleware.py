"""Keep identity-scoped API responses out of shared/browser HTTP caches."""
from django.utils.cache import patch_vary_headers


class PrivateApiResponseMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        response = self.get_response(request)
        if request.path_info.startswith('/api-projects/'):
            response['Cache-Control'] = 'private, no-store'
            patch_vary_headers(response, ('Authorization', 'Cookie'))
        return response
