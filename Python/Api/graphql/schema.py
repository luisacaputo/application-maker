from Api.graphql.mutation import Mutation as ApiMutation
from Api.graphql.query import Query as ApiQuery
# from Api.graphql.query.ContentType import ContentTypeType
from Core.utils import CustomNode
from graphene_django.filter import DjangoFilterConnectionField

class Query(ApiQuery):
    pass

class Mutation(ApiMutation):
  pass