import json
from typing import List

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

import models
import schemas
from database import Base, engine, get_db

Base.metadata.create_all(bind=engine)

app = FastAPI(title="Nested Tags Tree API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


def _to_out(record: models.Tree) -> schemas.TreeOut:
    return schemas.TreeOut(
        id=record.id,
        tree=schemas.TagNode(**json.loads(record.payload)),
        created_at=record.created_at,
        updated_at=record.updated_at,
    )


@app.get("/trees", response_model=List[schemas.TreeOut])
def list_trees(db: Session = Depends(get_db)):
    records = db.query(models.Tree).order_by(models.Tree.id.asc()).all()
    return [_to_out(r) for r in records]


@app.get("/trees/{tree_id}", response_model=schemas.TreeOut)
def get_tree(tree_id: int, db: Session = Depends(get_db)):
    record = db.query(models.Tree).filter(models.Tree.id == tree_id).first()
    if record is None:
        raise HTTPException(status_code=404, detail="Tree not found")
    return _to_out(record)


@app.post("/trees", response_model=schemas.TreeOut, status_code=201)
def create_tree(payload: schemas.TreeCreate, db: Session = Depends(get_db)):
    record = models.Tree(payload=payload.tree.model_dump_json(exclude_none=True))
    db.add(record)
    db.commit()
    db.refresh(record)
    return _to_out(record)


@app.put("/trees/{tree_id}", response_model=schemas.TreeOut)
def update_tree(tree_id: int, payload: schemas.TreeUpdate, db: Session = Depends(get_db)):
    record = db.query(models.Tree).filter(models.Tree.id == tree_id).first()
    if record is None:
        raise HTTPException(status_code=404, detail="Tree not found")
    record.payload = payload.tree.model_dump_json(exclude_none=True)
    db.commit()
    db.refresh(record)
    return _to_out(record)


@app.delete("/trees/{tree_id}", status_code=204)
def delete_tree(tree_id: int, db: Session = Depends(get_db)):
    record = db.query(models.Tree).filter(models.Tree.id == tree_id).first()
    if record is None:
        raise HTTPException(status_code=404, detail="Tree not found")
    db.delete(record)
    db.commit()
    return None
