# Copyright (c) 2026 Connor Gasgarth
"""Export the pinned upstream BlurBall network with current PyTorch APIs."""

import importlib.util
from pathlib import Path
from typing import TYPE_CHECKING, cast, override

import torch
from omegaconf import DictConfig, OmegaConf
from torch import nn

if TYPE_CHECKING:
    from collections.abc import Callable


class TensorOutput(nn.Module):
    """Select the full-resolution output from the upstream multi-scale model."""

    def __init__(self, model: nn.Module) -> None:
        """Wrap the upstream model without changing its trained parameters."""
        super().__init__()
        self.model = model

    @override
    def forward(self, tensor: torch.Tensor) -> torch.Tensor:
        """Return the three-frame ball heatmaps."""
        output = cast("dict[int, torch.Tensor]", self.model(tensor))
        return output[0]


def export_model() -> None:
    """Load verified research assets and save a portable inference graph."""
    root = Path(__file__).resolve().parents[3] / ".data"
    source = root / "vendor" / "blurball.py"
    spec = importlib.util.spec_from_file_location("blurball_upstream", source)
    if spec is None or spec.loader is None:
        msg = "Run bun run setup to download BlurBall first."
        raise RuntimeError(msg)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    factory = cast("Callable[[DictConfig], nn.Module]", module.BlurBall)
    config = OmegaConf.load(root / "vendor" / "blurball.yaml")
    if not isinstance(config, DictConfig):
        msg = "Invalid model configuration."
        raise TypeError(msg)
    model = factory(config).eval()
    checkpoint = cast(
        "dict[str, object]",
        torch.load(
            root / "models" / "blurball.ckpt",
            map_location="cpu",
            weights_only=True,
        ),
    )
    state = cast("dict[str, torch.Tensor]", checkpoint["model_state_dict"])
    model.load_state_dict(state, strict=True)
    exported = torch.export.export(TensorOutput(model), (torch.zeros(1, 9, 288, 512),))
    torch.export.save(exported, root / "models" / "blurball.pt2")


if __name__ == "__main__":
    export_model()
