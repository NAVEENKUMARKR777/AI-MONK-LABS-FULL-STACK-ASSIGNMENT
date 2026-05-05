from __future__ import annotations

from datetime import datetime
from typing import Any, List, Optional

from pydantic import BaseModel, Field, model_validator


class TagNode(BaseModel):
    name: str
    children: Optional[List["TagNode"]] = None
    data: Optional[str] = None

    @model_validator(mode="after")
    def validate_children_or_data(self) -> "TagNode":
        if self.children is not None and self.data is not None:
            raise ValueError("A tag cannot have both 'children' and 'data'.")
        return self


TagNode.model_rebuild()


class TreeCreate(BaseModel):
    tree: TagNode


class TreeUpdate(BaseModel):
    tree: TagNode


class TreeOut(BaseModel):
    id: int
    tree: TagNode
    created_at: datetime
    updated_at: datetime
