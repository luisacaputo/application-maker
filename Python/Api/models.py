from uuid import uuid4
from django.db import models


class Projects(models.Model):
  id = models.UUIDField(default=uuid4, primary_key=True, blank=False)
  name = models.CharField(max_length=50, unique=True, null=False, blank=False)
  dbType = models.CharField(max_length=50, null=False, blank=False)
  dbHost = models.CharField(max_length=50, null=False, blank=False)
  dbUserName = models.CharField(max_length=50, null=False, blank=False)
  dbName = models.CharField(max_length=50, null=False, blank=False)
  dbHostPort = models.IntegerField(blank=True)
  createDockerImage = models.BooleanField(default=False)
  createDockerImage = models.FloatField(default=0)
  class Meta:
    db_table = 'Projects'

  def __str__(self) -> str:
      return self.name