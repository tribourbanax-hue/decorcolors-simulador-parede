import base64
import io
import threading
import time
import urllib.request
import uuid
from pathlib import Path

import numpy as np
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from PIL import Image
from pydantic import BaseModel

BASE_DIR = Path(__file__).parent
MODELS_DIR = BASE_DIR / "models"
STATIC_DIR = BASE_DIR / "static"
CHECKPOINT_PATH = MODELS_DIR / "mobile_sam.pt"
CHECKPOINT_URL = "https://github.com/ChaoningZhang/MobileSAM/raw/master/weights/mobile_sam.pt"
MAX_DIM = 1024
SESSION_TTL_SECONDS = 60 * 30

app = FastAPI(title="DecorColors - Simulador de Parede")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

_model_lock = threading.Lock()
_predictor = None
_sessions: dict[str, dict] = {}


def _ensure_checkpoint():
    if CHECKPOINT_PATH.exists():
        return
    MODELS_DIR.mkdir(parents=True, exist_ok=True)
    print(f"Baixando checkpoint MobileSAM de {CHECKPOINT_URL} ...")
    urllib.request.urlretrieve(CHECKPOINT_URL, CHECKPOINT_PATH)
    print("Checkpoint baixado.")


def _get_predictor():
    global _predictor
    if _predictor is None:
        _ensure_checkpoint()
        from mobile_sam import SamPredictor, sam_model_registry

        model = sam_model_registry["vit_t"](checkpoint=str(CHECKPOINT_PATH))
        model.eval()
        _predictor = SamPredictor(model)
    return _predictor


def _cleanup_sessions():
    now = time.time()
    expired = [k for k, v in _sessions.items() if now - v["created_at"] > SESSION_TTL_SECONDS]
    for k in expired:
        _sessions.pop(k, None)


class SegmentPoint(BaseModel):
    x: float
    y: float
    label: int = 1


class SegmentRequest(BaseModel):
    image_id: str
    points: list[SegmentPoint]


@app.on_event("startup")
def _warm_up():
    threading.Thread(target=_get_predictor, daemon=True).start()


@app.get("/")
def index():
    return FileResponse(STATIC_DIR / "index.html")


@app.post("/api/upload")
async def upload(photo: UploadFile = File(...)):
    raw = await photo.read()
    try:
        img = Image.open(io.BytesIO(raw)).convert("RGB")
    except Exception:
        raise HTTPException(400, "Arquivo de imagem inválido.")

    w, h = img.size
    scale = min(1.0, MAX_DIM / max(w, h))
    if scale < 1.0:
        img = img.resize((int(w * scale), int(h * scale)), Image.LANCZOS)

    image_np = np.array(img)

    predictor = _get_predictor()
    with _model_lock:
        predictor.set_image(image_np)
        features = predictor.features.clone()
        original_size = predictor.original_size
        input_size = predictor.input_size

    _cleanup_sessions()
    image_id = uuid.uuid4().hex
    _sessions[image_id] = {
        "features": features,
        "original_size": original_size,
        "input_size": input_size,
        "created_at": time.time(),
    }

    return JSONResponse({"image_id": image_id, "width": image_np.shape[1], "height": image_np.shape[0]})


@app.post("/api/segment")
def segment(req: SegmentRequest):
    session = _sessions.get(req.image_id)
    if session is None:
        raise HTTPException(404, "Sessão expirada, envie a foto novamente.")
    if not req.points:
        raise HTTPException(400, "Informe ao menos um ponto na parede.")

    predictor = _get_predictor()
    point_coords = np.array([[p.x, p.y] for p in req.points], dtype=np.float32)
    point_labels = np.array([p.label for p in req.points], dtype=np.int32)

    with _model_lock:
        predictor.features = session["features"]
        predictor.original_size = session["original_size"]
        predictor.input_size = session["input_size"]
        predictor.is_image_set = True
        masks, scores, _ = predictor.predict(
            point_coords=point_coords,
            point_labels=point_labels,
            multimask_output=True,
        )

    best = masks[int(np.argmax(scores))]
    alpha = (best * 255).astype(np.uint8)
    rgba = np.zeros((*alpha.shape, 4), dtype=np.uint8)
    rgba[..., 3] = alpha
    mask_img = Image.fromarray(rgba, mode="RGBA")
    buf = io.BytesIO()
    mask_img.save(buf, format="PNG")
    mask_b64 = base64.b64encode(buf.getvalue()).decode("ascii")

    return JSONResponse({"mask": f"data:image/png;base64,{mask_b64}", "score": float(scores.max())})


app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")
