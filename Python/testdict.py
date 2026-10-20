dbCollection = [
  {
    "_key": "3182",
    "username": "dercio",
    "email": "derciosinione@gmail.com",
    "crimes": 3
  },
  {
    "_key": "175361",
    "username": "anajulia",
    "email": "anajulia@gmail.com"
  },
  {
    "_key": "175407",
    "username": "derone",
    "email": "derone@gmail.com",
    "password": "1234",
    "is_active": True
  }
  ]

class ParseDict(object):
  @classmethod
  def getCollectionTypes(cls, collection: list):
    filterCollection = dict()
    for item in collection:
      filterCollection.update(item)
    return [{key: type(filterCollection[key])} for key in filterCollection]

