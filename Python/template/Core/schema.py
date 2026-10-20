from graphene import ObjectType, Schema, String

try:
    from graphene_crud_maker.core import CrudMaker
    exclude = ['id', 'creation_date', 'updated_date', 'update_date', 'date_joined', 'last_login',]
    CrudMaker(app_name='Api', exclude_fields=exclude)
except:
    print('Application Could not find module graphene_crud_maker')
    pass


# Here is where you will put your schema from app you have created
from Api.graphql.schema import Mutation as ApiMutation
from Api.graphql.schema import Query as ApiQuery


class Query(ApiQuery):
    hello = String(default_value="Hi!")


class Mutation(ApiMutation, ObjectType,):
    pass


schema = Schema(query=Query, mutation=Mutation)