from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session, select, func
from typing import List, Optional
from datetime import timezone
import json
import os
from pathlib import Path

from app.database import get_session
from app.models.generation import ImageAsset, Board
from app.models.schemas import BoardCreate, BoardRead, ImageAssetRead, BatchDeleteImagesRequest
from app.config import settings

router = APIRouter(prefix="/api", tags=["gallery"])


@router.get("/boards", response_model=List[BoardRead])
def list_boards(session: Session = Depends(get_session)):
    boards = session.exec(select(Board)).all()
    result = []
    for b in boards:
        # Count images in board
        count = session.exec(select(func.count(ImageAsset.id)).where(ImageAsset.board_id == b.id)).one()
        b_created = b.created_at.replace(tzinfo=timezone.utc) if b.created_at and b.created_at.tzinfo is None else b.created_at
        result.append(BoardRead(
            id=b.id,
            name=b.name,
            description=b.description,
            created_at=b_created,
            image_count=count
        ))
    return result

@router.post("/boards", response_model=BoardRead)
def create_board(req: BoardCreate, session: Session = Depends(get_session)):
    existing = session.exec(select(Board).where(Board.name == req.name)).first()
    if existing:
        raise HTTPException(status_code=400, detail="Board with this name already exists")
    
    board = Board(name=req.name, description=req.description)
    session.add(board)
    session.commit()
    session.refresh(board)
    b_created = board.created_at.replace(tzinfo=timezone.utc) if board.created_at and board.created_at.tzinfo is None else board.created_at
    return BoardRead(
        id=board.id,
        name=board.name,
        description=board.description,
        created_at=b_created,
        image_count=0
    )

@router.get("/images", response_model=List[ImageAssetRead])
def list_images(
    board_id: Optional[int] = None,
    limit: int = 50,
    offset: int = 0,
    session: Session = Depends(get_session)
):
    query = select(ImageAsset).order_by(ImageAsset.created_at.desc())
    if board_id is not None:
        query = query.where(ImageAsset.board_id == board_id)
    query = query.offset(offset).limit(limit)
    
    images = session.exec(query).all()
    result = []
    for img in images:
        styles = []
        try:
            styles = json.loads(img.styles_applied or "[]")
        except Exception:
            pass

        img_created = img.created_at.replace(tzinfo=timezone.utc) if img.created_at and img.created_at.tzinfo is None else img.created_at
        result.append(ImageAssetRead(
            id=img.id,
            filename=img.filename,
            filepath=img.filepath,
            url=f"/outputs/{img.filename}",
            prompt=img.prompt,
            negative_prompt=img.negative_prompt,
            styles_applied=styles,
            model_name=img.model_name,
            sampler=img.sampler,
            scheduler=img.scheduler,
            steps=img.steps,
            cfg_scale=img.cfg_scale,
            seed=img.seed,
            width=img.width,
            height=img.height,
            is_inpaint=img.is_inpaint,
            is_img2img=getattr(img, "is_img2img", False),
            is_upscale=getattr(img, "is_upscale", False),
            board_id=img.board_id,
            created_at=img_created
        ))
    return result

@router.patch("/images/{image_id}/board")
def assign_image_board(
    image_id: int,
    board_id: Optional[int] = Query(None),
    session: Session = Depends(get_session)
):
    image = session.get(ImageAsset, image_id)
    if not image:
        raise HTTPException(status_code=404, detail="Image not found")
    
    if board_id is not None:
        board = session.get(Board, board_id)
        if not board:
            raise HTTPException(status_code=404, detail="Board not found")
        image.board_id = board.id
    else:
        image.board_id = None

    session.add(image)
    session.commit()
    return {"status": "ok", "image_id": image.id, "board_id": image.board_id}

@router.delete("/images/{image_id}")
def delete_image(image_id: int, session: Session = Depends(get_session)):
    image = session.get(ImageAsset, image_id)
    if not image:
        raise HTTPException(status_code=404, detail="Image not found")
    
    # Try deleting file on disk
    try:
        fp = Path(image.filepath)
        if fp.exists():
            fp.unlink()
    except Exception:
        pass

    session.delete(image)
    session.commit()
    return {"status": "ok", "deleted_id": image_id}

@router.post("/images/delete-batch")
def delete_images_batch(req: BatchDeleteImagesRequest, session: Session = Depends(get_session)):
    deleted_ids = []
    for image_id in req.image_ids:
        image = session.get(ImageAsset, image_id)
        if image:
            try:
                fp = Path(image.filepath)
                if fp.exists():
                    fp.unlink()
            except Exception:
                pass
            session.delete(image)
            deleted_ids.append(image_id)
    session.commit()
    return {"status": "ok", "deleted_ids": deleted_ids}

