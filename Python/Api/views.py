from django.contrib.auth.mixins import LoginRequiredMixin
from graphene_django.views import GraphQLView


class PrivateGraphQLView(LoginRequiredMixin, GraphQLView):
  pass


# class CustomGraphQLView(GraphQLView):
  
#     @staticmethod
#     def format_error(error):
#         if hasattr(error, 'original_error') and error.original_error:
#             formatted = {"message": str(error.original_error)}
#             if isinstance(error.original_error, UnauthorizedError):
#                 formatted['code'] = "401"
#             elif isinstance(error.original_error, PermissionDeniedError):
#                 formatted['code'] = "403"
#             return formatted

#         return GraphQLView.format_error(error)
    
# class LoginRequiredMixin:
#     def dispatch(self, info, *args, **kwargs):
#         if not info.user.is_authenticated:
#             e =  HttpError(HttpResponse(status=401, content_type='application/json'), 'Please log in first')
#             response = e.response
#             response.content = self.json_encode(info, [{'errors': [self.format_error(e)]}])
#             return response

#         return super().dispatch(info, *args, **kwargs)

# class PrivateGraphQLView(LoginRequiredMixin, GraphQLView):
#     pass
