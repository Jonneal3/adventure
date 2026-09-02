"""Versioned launch registry for priceable before/after gallery work.

The registry is deliberately closed.  Model output can select values from it,
but cannot define pricing rules, units, or before-image behavior.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Dict, Iterable, Mapping, Optional, Sequence, Tuple


REGISTRY_VERSION = 1
TIERS = ("value", "mid", "premium", "luxury")


def slug(value: object) -> str:
    return re.sub(r"_+", "_", re.sub(r"[^a-z0-9]+", "_", str(value or "").strip().lower())).strip("_")


@dataclass(frozen=True)
class RateBand:
    low: float
    likely: float
    high: float


@dataclass(frozen=True)
class PricingRule:
    material: RateBand
    labor: RateBand
    preparation: RateBand = RateBand(0, 0, 0)
    removal: RateBand = RateBand(0, 0, 0)
    installation: RateBand = RateBand(0, 0, 0)
    permit_rate: float = 0.0
    contingency_rate: float = 0.06


@dataclass(frozen=True)
class QuantityRule:
    unit: str
    minimum: float
    maximum: float
    default_low: float
    default_likely: float
    default_high: float


@dataclass(frozen=True)
class ComponentDefinition:
    key: str
    label: str
    quantity: QuantityRule
    pricing: PricingRule
    after_description: str
    before_strategy: str
    subtypes: Tuple[str, ...] = ()
    materials: Tuple[str, ...] = ()
    tiers: Tuple[str, ...] = TIERS
    attributes: Mapping[str, Tuple[str, ...]] = field(default_factory=dict)
    aliases: Tuple[str, ...] = ()


@dataclass(frozen=True)
class PricingFamilyDefinition:
    key: str
    label: str
    service_key: str
    service_aliases: Tuple[str, ...]
    components: Mapping[str, ComponentDefinition]


def _band(low: float, likely: float, high: float) -> RateBand:
    return RateBand(low, likely, high)


def _quantity(unit: str, minimum: float, maximum: float, default: Sequence[float]) -> QuantityRule:
    return QuantityRule(unit, minimum, maximum, float(default[0]), float(default[1]), float(default[2]))


def _component(
    key: str,
    label: str,
    unit: str,
    bounds: Tuple[float, float],
    default: Sequence[float],
    *,
    material: Sequence[float],
    labor: Sequence[float],
    after: str,
    before: str,
    preparation: Sequence[float] = (0, 0, 0),
    removal: Sequence[float] = (0, 0, 0),
    installation: Sequence[float] = (0, 0, 0),
    permit_rate: float = 0.0,
    contingency_rate: float = 0.06,
    subtypes: Sequence[str] = (),
    materials: Sequence[str] = (),
    attributes: Optional[Mapping[str, Sequence[str]]] = None,
    aliases: Sequence[str] = (),
) -> ComponentDefinition:
    return ComponentDefinition(
        key=key,
        label=label,
        quantity=_quantity(unit, bounds[0], bounds[1], default),
        pricing=PricingRule(
            material=_band(*material),
            labor=_band(*labor),
            preparation=_band(*preparation),
            removal=_band(*removal),
            installation=_band(*installation),
            permit_rate=permit_rate,
            contingency_rate=contingency_rate,
        ),
        after_description=after,
        before_strategy=before,
        subtypes=tuple(subtypes),
        materials=tuple(materials),
        attributes={key: tuple(values) for key, values in (attributes or {}).items()},
        aliases=tuple(aliases),
    )


def _family(
    key: str,
    label: str,
    service_key: str,
    aliases: Sequence[str],
    components: Iterable[ComponentDefinition],
) -> PricingFamilyDefinition:
    rows = tuple(components)
    return PricingFamilyDefinition(key, label, service_key, tuple(aliases), {row.key: row for row in rows})


FAMILIES: Dict[str, PricingFamilyDefinition] = {
    "bathroom_remodel": _family("bathroom_remodel", "Bathroom remodeling", "bathroom_remodeling", ("bathroom", "bath remodel", "bathroom renovation"), (
        _component("vanity", "Vanity", "each", (1, 4), (1, 1, 1), material=(900, 2200, 5000), labor=(500, 1000, 1900), preparation=(100, 250, 500), removal=(150, 300, 550), after="installed vanity, countertop, sink, and coordinated hardware", before="replace with a clean maintained builder-grade vanity in the same position", subtypes=("single", "double", "floating"), materials=("laminate", "quartz", "natural_stone", "wood")),
        _component("shower", "Shower", "each", (1, 3), (1, 1, 1), material=(2200, 5200, 11000), labor=(2500, 5200, 9500), preparation=(500, 1200, 2400), removal=(600, 1300, 2500), permit_rate=.03, after="finished shower enclosure with waterproofed tile surround and fixtures", before="show a simple maintained prefabricated shower or basic tile surround with the same footprint", subtypes=("walk_in", "tub_shower", "curbless"), materials=("acrylic", "ceramic_tile", "porcelain_tile", "natural_stone")),
        _component("bathtub", "Bathtub", "each", (1, 2), (1, 1, 1), material=(700, 1800, 5500), labor=(900, 1800, 3500), preparation=(150, 350, 800), removal=(250, 500, 900), after="installed bathtub with finished surround and fixtures", before="show a clean basic alcove tub in the identical location", subtypes=("alcove", "freestanding", "soaking"), materials=("acrylic", "cast_iron", "composite")),
        _component("floor_tile", "Bathroom floor tile", "sq_ft", (20, 500), (60, 100, 160), material=(4, 10, 24), labor=(7, 13, 23), preparation=(2, 4, 7), removal=(2, 4, 7), after="finished bathroom floor tile installed across the visible floor", before="replace with clean basic sheet vinyl or plain ceramic tile while preserving the floor plan", materials=("ceramic", "porcelain", "natural_stone"), aliases=("tile_floor", "bathroom_flooring")),
        _component("wall_tile", "Wall tile", "sq_ft", (20, 800), (80, 140, 220), material=(5, 12, 30), labor=(9, 17, 32), preparation=(3, 6, 10), removal=(2, 5, 9), after="finished wall tile across the specified wet-area surfaces", before="use a simple maintained surround or plain wall finish on those same surfaces", materials=("ceramic", "porcelain", "natural_stone", "glass")),
        _component("bathroom_lighting", "Bathroom lighting", "each", (1, 12), (2, 3, 5), material=(90, 260, 850), labor=(120, 240, 500), installation=(40, 100, 180), after="coordinated installed vanity or ceiling lighting", before="show basic functional fixtures in the same electrical positions", subtypes=("vanity", "sconce", "ceiling", "recessed"), aliases=("lighting",)),
    )),
    "kitchen_remodel": _family("kitchen_remodel", "Kitchen remodeling", "kitchen_remodeling", ("kitchen", "kitchen remodel", "kitchen renovation"), (
        _component("cabinets", "Kitchen cabinets", "linear_ft", (6, 120), (16, 24, 36), material=(180, 420, 950), labor=(90, 190, 360), preparation=(20, 45, 90), removal=(25, 60, 110), after="installed coordinated kitchen cabinetry across the specified run", before="show clean maintained stock cabinets in the identical layout", subtypes=("stock", "semi_custom", "custom"), materials=("laminate", "painted_wood", "stained_wood", "wood_veneer")),
        _component("countertops", "Countertops", "sq_ft", (10, 250), (35, 55, 80), material=(25, 70, 180), labor=(18, 38, 80), preparation=(4, 9, 18), removal=(5, 12, 22), after="installed finished countertops with realistic seams and edges", before="replace with clean basic laminate countertops without changing the cabinet layout", materials=("laminate", "quartz", "granite", "marble", "butcher_block")),
        _component("kitchen_island", "Kitchen island", "each", (1, 3), (1, 1, 1), material=(2500, 6000, 16000), labor=(1200, 2800, 6000), preparation=(300, 700, 1500), installation=(250, 700, 1400), permit_rate=.025, after="finished kitchen island with coordinated cabinetry and worktop", before="remove the island only when the registered scope adds it; otherwise show a simple maintained island in the same footprint", subtypes=("worktop", "seating", "sink", "cooktop"), materials=("painted_wood", "stained_wood", "wood_veneer"), aliases=("island",)),
        _component("backsplash", "Backsplash", "sq_ft", (10, 200), (25, 40, 65), material=(4, 12, 35), labor=(8, 16, 30), preparation=(2, 5, 10), removal=(1, 4, 8), after="installed backsplash across the visible counter runs", before="show a clean painted wall or plain basic tile on the same backsplash area", materials=("ceramic", "porcelain", "glass", "natural_stone")),
        _component("appliance_package", "Appliance package", "each", (1, 8), (3, 4, 5), material=(700, 1800, 5000), labor=(120, 260, 550), installation=(80, 180, 350), after="installed coordinated kitchen appliance package", before="show clean standard appliances in the same locations", subtypes=("standard", "counter_depth", "professional"), materials=("white", "black", "stainless_steel", "panel_ready"), aliases=("appliances",)),
        _component("kitchen_flooring", "Kitchen flooring", "sq_ft", (40, 1200), (180, 300, 500), material=(3, 9, 22), labor=(4, 8, 16), preparation=(1, 3, 7), removal=(1, 3, 6), after="finished kitchen flooring throughout the visible room", before="show clean basic resilient flooring with the same room boundaries", materials=("lvp", "hardwood", "tile", "laminate"), aliases=("flooring",)),
    )),
    "general_remodel": _family("general_remodel", "General remodeling", "general_remodeling", ("general remodeling", "home remodel", "renovation", "room remodel"), (
        _component("room_renovation", "Room renovation", "sq_ft", (50, 5000), (250, 500, 900), material=(25, 55, 120), labor=(30, 65, 135), preparation=(5, 12, 25), removal=(4, 10, 22), permit_rate=.035, after="cohesive finished room renovation within the existing shell", before="show a clean maintained builder-grade version of the same room and layout", subtypes=("cosmetic", "full_finish", "layout_preserving"), materials=("standard", "upgraded", "custom")),
        _component("interior_wall_change", "Interior wall modification", "linear_ft", (4, 120), (10, 20, 35), material=(80, 180, 350), labor=(140, 300, 600), preparation=(30, 80, 160), removal=(40, 100, 200), permit_rate=.06, after="completed permitted wall modification with integrated finishes", before="restore the original plausible wall boundary while keeping camera and surrounding architecture fixed", subtypes=("opening", "partition", "half_wall"), materials=("drywall", "wood_framing", "steel_framing")),
        _component("built_in_storage", "Built-in storage", "linear_ft", (3, 80), (8, 14, 22), material=(250, 600, 1400), labor=(180, 420, 900), preparation=(20, 60, 130), installation=(40, 120, 240), after="installed built-in cabinetry or shelving along the specified wall", before="show the same wall clean and maintained without the custom built-in", subtypes=("shelving", "cabinetry", "media_wall"), materials=("painted_mdf", "wood_veneer", "solid_wood")),
        _component("finish_upgrade", "Interior finish upgrade", "sq_ft", (50, 5000), (250, 500, 900), material=(6, 16, 38), labor=(8, 20, 44), preparation=(2, 6, 14), removal=(1, 4, 9), after="coordinated upgraded visible wall, floor, and trim finishes", before="show clean basic finishes on the exact same surfaces", subtypes=("walls", "floors", "trim", "mixed"), materials=("standard", "upgraded", "custom")),
    )),
    "landscape_design": _family("landscape_design", "Landscaping", "landscaping", ("landscape", "landscaping", "yard", "garden design", "outdoor living"), (
        _component("paver_patio", "Paver patio", "sq_ft", (40, 5000), (250, 450, 750), material=(8, 16, 30), labor=(9, 17, 31), preparation=(3, 7, 13), removal=(0, 2, 6), after="finished paver patio with consistent joints and edge restraint", before="show maintained lawn or a smaller plain concrete area within the same boundaries", subtypes=("concrete_paver", "brick_paver", "porcelain_paver", "natural_stone_paver"), materials=("concrete", "brick", "porcelain", "natural_stone"), aliases=("patio", "hardscape")),
        _component("fire_pit", "Fire pit", "each", (1, 3), (1, 1, 1), material=(700, 2400, 6500), labor=(500, 1400, 3500), preparation=(150, 450, 1000), permit_rate=.04, after="finished code-compliant fire pit integrated into the seating zone", before="remove the fire feature and show an ordinary maintained open area in the same zone", subtypes=("portable", "built_in_gas", "built_in_wood"), materials=("metal", "concrete_block", "natural_stone")),
        _component("landscape_lighting", "Landscape lighting", "each", (1, 80), (6, 10, 16), material=(70, 150, 330), labor=(70, 140, 260), installation=(30, 75, 150), after="installed low-voltage path or accent lighting", before="remove the decorative lighting while preserving daylight direction and landscape geometry", subtypes=("path", "uplight", "step", "mixed"), aliases=("lighting",)),
        _component("planting_bed", "Planting beds", "sq_ft", (20, 5000), (150, 300, 600), material=(4, 10, 24), labor=(3, 7, 15), preparation=(1, 3, 7), removal=(0, 1, 3), after="designed planting bed with believable mature spacing and mulch", before="show maintained sparse foundation planting or lawn in the same bed boundaries", subtypes=("foundation", "pollinator", "screening", "mixed"), materials=("native", "ornamental", "evergreen", "mixed")),
        _component("turf", "Turf or lawn", "sq_ft", (100, 20000), (800, 1600, 3000), material=(1, 3, 9), labor=(1, 2.5, 6), preparation=(.5, 1.5, 4), after="uniform installed lawn or turf within the specified area", before="show a maintained but ordinary lawn of the same shape", subtypes=("sod", "seed", "artificial_turf"), materials=("cool_season", "warm_season", "synthetic")),
    )),
    "deck_patio": _family("deck_patio", "Decks and patios", "decks_and_patios", ("deck", "patio", "pergola", "porch"), (
        _component("deck", "Deck", "sq_ft", (60, 3000), (250, 450, 700), material=(14, 28, 58), labor=(16, 31, 60), preparation=(3, 7, 14), removal=(0, 5, 12), permit_rate=.05, after="finished code-compliant deck with believable structure and transitions", before="show an ordinary maintained yard or smaller basic platform within the same footprint", subtypes=("ground_level", "raised", "multi_level"), materials=("pressure_treated_wood", "cedar", "composite", "pvc")),
        _component("patio", "Patio", "sq_ft", (40, 5000), (250, 450, 750), material=(6, 15, 35), labor=(8, 18, 36), preparation=(3, 7, 14), removal=(0, 3, 8), after="finished patio surface with realistic drainage and edges", before="show maintained lawn or a plain smaller slab in the same outdoor zone", subtypes=("slab", "paver", "stone"), materials=("concrete", "concrete_paver", "brick", "natural_stone")),
        _component("pergola", "Pergola", "sq_ft", (40, 1200), (120, 220, 360), material=(18, 42, 90), labor=(15, 35, 70), preparation=(2, 6, 14), installation=(3, 9, 20), permit_rate=.04, after="installed pergola aligned with the patio or deck", before="remove the shade structure while preserving the patio, camera, and house", materials=("wood", "aluminum", "vinyl")),
        _component("railing", "Railing", "linear_ft", (8, 500), (40, 70, 110), material=(35, 85, 190), labor=(30, 65, 135), removal=(0, 8, 18), installation=(5, 15, 32), after="installed code-compliant railing following the visible edge", before="show a simple code-compliant wood railing in the same positions", materials=("wood", "aluminum", "cable", "glass")),
        _component("deck_lighting", "Deck and patio lighting", "each", (1, 60), (6, 10, 16), material=(60, 150, 350), labor=(70, 150, 300), installation=(25, 70, 150), after="integrated installed step, post, or overhead lighting", before="remove decorative lighting but keep functional ambient light", subtypes=("step", "post", "string", "mixed"), aliases=("lighting",)),
    )),
    "pool_build": _family("pool_build", "Pools", "pools", ("pool", "swimming pool", "spa", "hot tub"), (
        _component("pool", "Swimming pool", "each", (1, 2), (1, 1, 1), material=(18000, 38000, 80000), labor=(17000, 32000, 65000), preparation=(5000, 10000, 20000), removal=(0, 1000, 5000), permit_rate=.06, contingency_rate=.1, after="completed code-compliant pool with realistic waterline, coping, and equipment", before="remove the pool and restore a plausible maintained yard within the same boundaries", subtypes=("fiberglass", "vinyl_liner", "gunite"), materials=("fiberglass", "vinyl", "plaster", "pebble")),
        _component("spa", "Spa", "each", (1, 2), (1, 1, 1), material=(4500, 10000, 24000), labor=(2500, 6000, 14000), preparation=(800, 2500, 6000), permit_rate=.04, after="installed spa integrated with the pool or deck", before="remove the spa and show an ordinary maintained deck or yard area", subtypes=("portable", "built_in", "raised"), materials=("acrylic", "plaster", "pebble")),
        _component("pool_decking", "Pool decking", "sq_ft", (100, 5000), (500, 800, 1300), material=(6, 15, 38), labor=(7, 16, 32), preparation=(2, 5, 12), removal=(0, 3, 8), after="finished non-slip pool decking around the visible pool perimeter", before="show a smaller plain concrete apron or maintained lawn in the same area", materials=("concrete", "paver", "travertine", "porcelain")),
        _component("pool_water_feature", "Pool water feature", "each", (1, 10), (1, 2, 3), material=(800, 2600, 7500), labor=(700, 1900, 5000), installation=(250, 750, 1800), after="installed integrated water feature with plausible plumbing", before="remove the decorative water feature without changing the pool shell", subtypes=("bubbler", "sheer_descent", "waterfall"), aliases=("water_feature",)),
        _component("pool_lighting", "Pool lighting", "each", (1, 20), (2, 4, 7), material=(250, 600, 1400), labor=(250, 550, 1200), installation=(80, 220, 500), after="installed code-compliant underwater or perimeter lighting", before="show standard functional pool lighting only", subtypes=("underwater", "perimeter", "mixed"), aliases=("lighting",)),
    )),
    "roofing": _family("roofing", "Roofing", "roofing", ("roof", "roofing", "reroof"), (
        _component("architectural_asphalt_shingles", "Architectural asphalt shingles", "square", (2, 100), (18, 28, 40), material=(140, 230, 380), labor=(170, 280, 450), preparation=(30, 65, 120), removal=(80, 140, 240), permit_rate=.025, after="uniform installed architectural asphalt shingle roof with correct flashing", before="show a maintained basic three-tab shingle roof on the same roof geometry", subtypes=("standard", "impact_resistant", "designer"), materials=("asphalt",), aliases=("asphalt_shingles", "shingles")),
        _component("metal_roofing", "Metal roofing", "square", (2, 100), (18, 28, 40), material=(350, 650, 1100), labor=(300, 520, 900), preparation=(50, 100, 180), removal=(80, 150, 260), permit_rate=.025, after="uniform installed metal roofing with realistic seams and flashing", before="show a maintained basic asphalt shingle roof on the identical roof structure", subtypes=("standing_seam", "exposed_fastener", "metal_shingle"), materials=("steel", "aluminum", "copper")),
        _component("roof_flashing", "Roof flashing", "linear_ft", (10, 1000), (80, 140, 220), material=(8, 18, 42), labor=(12, 28, 60), removal=(2, 6, 14), after="correctly installed flashing at visible roof transitions", before="show simple maintained standard flashing at the same transitions", subtypes=("step", "valley", "chimney", "mixed"), materials=("galvanized_steel", "aluminum", "copper"), aliases=("flashing",)),
        _component("gutters", "Gutters", "linear_ft", (20, 1000), (120, 190, 280), material=(5, 12, 28), labor=(5, 10, 22), removal=(1, 3, 6), installation=(1, 3, 7), after="installed continuous gutters and downspouts following the same eaves", before="show clean basic sectional gutters in the identical positions", subtypes=("k_style", "half_round"), materials=("aluminum", "steel", "copper")),
        _component("skylight", "Skylight", "each", (1, 12), (1, 2, 3), material=(700, 1500, 3800), labor=(900, 1800, 4200), preparation=(250, 650, 1500), permit_rate=.035, after="installed flashed skylight integrated into the roof plane", before="restore the same roof plane without the skylight", subtypes=("fixed", "vented", "tubular"), materials=("glass", "acrylic")),
    )),
    "flooring": _family("flooring", "Flooring", "flooring", ("floor", "flooring", "hardwood", "tile floor", "carpet"), (
        _component("flooring_install", "Flooring installation", "sq_ft", (40, 10000), (300, 700, 1400), material=(2, 8, 25), labor=(2.5, 6, 14), preparation=(.75, 2.5, 7), removal=(.75, 2, 6), after="professionally installed continuous finished flooring across the visible area", before="show clean maintained builder-grade flooring on the same floor plane", subtypes=("floating", "glue_down", "nail_down", "mortar_set"), materials=("lvp", "laminate", "hardwood", "engineered_wood", "tile", "carpet"), aliases=("hardwood_flooring", "tile_flooring", "carpet_installation")),
        _component("stairs_flooring", "Stair finish", "step", (3, 40), (10, 14, 18), material=(35, 110, 280), labor=(55, 140, 320), preparation=(10, 30, 80), removal=(8, 25, 65), after="coordinated finished stair treads and risers", before="show clean basic carpeted or painted stairs on the same structure", materials=("hardwood", "carpet", "lvp")),
        _component("baseboards", "Baseboards", "linear_ft", (20, 2000), (140, 260, 420), material=(2, 6, 16), labor=(3, 7, 15), removal=(.5, 1.5, 4), installation=(.5, 1.5, 4), after="installed coordinated baseboards following the same walls", before="show clean simple builder-grade baseboards in the same positions", materials=("mdf", "finger_jointed_wood", "hardwood")),
    )),
    "painting": _family("painting", "Painting", "painting", ("paint", "painting", "painter"), (
        _component("interior_paint", "Interior painting", "sq_ft", (100, 30000), (800, 1800, 3500), material=(.35, .7, 1.4), labor=(1.1, 2.2, 4.1), preparation=(.3, .7, 1.6), after="even professional interior paint finish on the specified surfaces", before="show a clean maintained neutral builder-grade paint color on the same surfaces", subtypes=("walls", "walls_and_ceiling", "whole_interior"), materials=("standard_paint", "premium_paint", "specialty_finish")),
        _component("exterior_paint", "Exterior painting", "sq_ft", (200, 30000), (1200, 2400, 4500), material=(.5, 1.1, 2.2), labor=(1.4, 3, 6), preparation=(.5, 1.2, 3), after="even professional exterior coating on the same facade surfaces", before="show a clean maintained conventional exterior color on the same siding and trim", subtypes=("siding", "trim", "whole_exterior"), materials=("acrylic", "elastomeric", "stain")),
        _component("cabinet_painting", "Cabinet painting", "door_drawer", (4, 150), (20, 35, 55), material=(18, 35, 70), labor=(45, 90, 170), preparation=(25, 55, 110), after="professionally refinished cabinet doors and drawer fronts", before="show clean maintained factory-finish cabinets in the same layout", materials=("enamel", "lacquer", "conversion_varnish")),
        _component("painted_trim", "Painted trim", "linear_ft", (20, 5000), (180, 350, 650), material=(.4, .9, 1.8), labor=(1.5, 3.5, 7), preparation=(.7, 1.8, 4), after="crisp professionally painted trim in the same locations", before="show clean basic white trim in the same profile and location", subtypes=("baseboard", "casing", "crown", "mixed"), aliases=("trim",)),
    )),
    "windows_siding": _family("windows_siding", "Windows and siding", "windows_and_siding", ("window", "windows", "siding", "exterior cladding"), (
        _component("replacement_window", "Replacement windows", "each", (1, 100), (6, 12, 20), material=(350, 800, 1800), labor=(250, 520, 1100), preparation=(40, 110, 260), removal=(50, 130, 300), after="installed replacement windows in the existing openings", before="show clean maintained basic windows with identical opening sizes", subtypes=("single_hung", "double_hung", "casement", "picture"), materials=("vinyl", "fiberglass", "wood", "aluminum_clad"), aliases=("windows",)),
        _component("siding", "Siding", "sq_ft", (100, 20000), (1200, 2200, 4000), material=(3, 9, 24), labor=(3, 8, 18), preparation=(1, 3, 7), removal=(1, 3, 7), permit_rate=.02, after="uniform installed siding across the visible facade", before="show clean maintained conventional siding on the same facade and openings", subtypes=("lap", "board_and_batten", "shingle", "panel"), materials=("vinyl", "fiber_cement", "engineered_wood", "natural_wood", "metal")),
        _component("exterior_door", "Exterior door", "each", (1, 12), (1, 2, 3), material=(700, 1800, 5500), labor=(500, 1100, 2600), preparation=(100, 300, 800), removal=(100, 250, 650), after="installed exterior door in the existing opening with finished trim", before="show a clean maintained standard exterior door in the same opening", subtypes=("entry", "patio", "french", "sliding"), materials=("fiberglass", "steel", "wood", "aluminum")),
        _component("exterior_trim", "Exterior trim", "linear_ft", (20, 3000), (160, 300, 520), material=(3, 9, 24), labor=(4, 10, 24), preparation=(1, 3, 8), removal=(1, 3, 7), after="installed coordinated exterior trim around the same openings and edges", before="show clean basic trim in the identical positions", materials=("pvc", "fiber_cement", "wood", "aluminum")),
    )),
    "interior_design": _family("interior_design", "Interior design", "interior_design", ("interior design", "interior decorator", "room design", "home styling"), (
        _component("living_room_furnishing_package", "Living room furnishing package", "room", (1, 10), (1, 1, 2), material=(4500, 11000, 30000), labor=(900, 2500, 7000), installation=(400, 1200, 3500), after="cohesive installed living-room furniture, rug, tables, and accessories", before="show the same maintained room with sparse basic appropriately scaled furnishings", subtypes=("essential", "complete", "designer"), materials=("mixed_standard", "mixed_premium", "mixed_luxury")),
        _component("bedroom_furnishing_package", "Bedroom furnishing package", "room", (1, 10), (1, 1, 2), material=(3000, 8000, 22000), labor=(700, 1900, 5200), installation=(300, 900, 2600), after="cohesive installed bedroom furniture, rug, lighting, and accessories", before="show the same maintained bedroom with simple basic furnishings", subtypes=("essential", "complete", "designer"), materials=("mixed_standard", "mixed_premium", "mixed_luxury")),
        _component("window_treatments", "Window treatments", "each", (1, 60), (4, 8, 14), material=(120, 450, 1400), labor=(80, 220, 600), installation=(30, 90, 240), after="installed fitted window treatments on the same windows", before="show simple maintained blinds or bare windows", subtypes=("shade", "drapery", "shutter", "layered"), materials=("fabric", "woven_wood", "wood", "composite")),
        _component("decorative_lighting", "Decorative lighting", "each", (1, 40), (3, 6, 10), material=(180, 650, 2400), labor=(140, 380, 950), installation=(50, 150, 400), after="installed decorative lighting aligned to existing electrical positions", before="show basic functional fixtures in the same positions", subtypes=("pendant", "chandelier", "sconce", "floor_lamp", "mixed"), aliases=("lighting",)),
        _component("art_styling", "Art and styling", "room", (1, 20), (1, 2, 3), material=(600, 2200, 8500), labor=(300, 900, 2800), installation=(100, 350, 1200), after="cohesive installed art and accessories scaled to the room", before="show the same maintained room with minimal generic decor", subtypes=("minimal", "collected", "gallery"), materials=("mixed_standard", "mixed_premium", "original_art")),
    )),
    "furniture": _family("furniture", "Furniture", "furniture", ("furniture", "sofa", "dining furniture", "bedroom furniture"), (
        _component("three_seat_sofa", "Three-seat sofa", "each", (1, 6), (1, 1, 2), material=(900, 2600, 7000), labor=(0, 0, 0), installation=(120, 280, 700), after="an installed 80-to-90-inch three-seat sofa accurately scaled to the room", before="show a clean basic correctly scaled sofa in the same position", subtypes=("standard", "bench_seat", "sleeper"), materials=("standard_fabric", "performance_fabric", "leather"), attributes={"width": ("80_in", "84_in", "90_in")}, aliases=("sofa", "couch")),
        _component("sectional", "Sectional sofa", "each", (1, 4), (1, 1, 1), material=(1800, 4800, 13000), labor=(0, 0, 0), installation=(180, 450, 1100), after="an installed sectional accurately scaled and oriented in the room", before="show a clean basic sofa and chair arrangement in the same seating zone", subtypes=("chaise", "l_shape", "u_shape", "modular"), materials=("standard_fabric", "performance_fabric", "leather")),
        _component("dining_set", "Dining set", "set", (1, 6), (1, 1, 1), material=(1000, 3200, 10000), labor=(0, 0, 0), installation=(140, 350, 900), after="installed dining table and coordinated chairs sized to the room", before="show a clean basic dining set with the same seating count", subtypes=("four_seat", "six_seat", "eight_seat", "extendable"), materials=("wood", "stone", "glass", "mixed")),
        _component("bed_frame", "Bed frame", "each", (1, 10), (1, 1, 2), material=(700, 2200, 7500), labor=(0, 0, 0), installation=(100, 250, 650), after="installed bed frame and headboard correctly scaled to the room", before="show a clean basic bed frame of the same mattress size", subtypes=("platform", "upholstered", "canopy", "storage"), materials=("wood", "fabric", "leather", "metal")),
        _component("accent_chair", "Accent chair", "each", (1, 20), (1, 2, 3), material=(300, 900, 2800), labor=(0, 0, 0), installation=(40, 100, 250), after="installed accent chair accurately scaled in the seating zone", before="remove the accent chair or show a basic chair in the same zone", subtypes=("club", "swivel", "lounge", "slipper"), materials=("standard_fabric", "performance_fabric", "leather", "wood")),
        _component("coffee_table", "Coffee table", "each", (1, 10), (1, 1, 2), material=(250, 850, 3000), labor=(0, 0, 0), installation=(30, 80, 200), after="installed coffee table scaled to the seating arrangement", before="show a clean basic coffee table of similar size", subtypes=("rectangular", "round", "nesting", "storage"), materials=("wood", "stone", "glass", "metal")),
    )),
    "nail_services": _family("nail_services", "Nail services", "nail_services", ("nail", "nails", "manicure", "acrylic nails", "nail salon"), (
        _component("acrylic_full_set", "Acrylic full set", "set", (1, 2), (1, 1, 1), material=(8, 14, 25), labor=(35, 55, 90), preparation=(5, 9, 15), after="a professionally shaped acrylic full set on all visible nails", before="show clean maintained natural nails of plausible length and shape", subtypes=("short", "medium", "long", "extra_long"), materials=("acrylic",), attributes={"shape": ("round", "square", "almond", "coffin", "stiletto")}),
        _component("gel_manicure", "Gel manicure", "set", (1, 2), (1, 1, 1), material=(5, 9, 16), labor=(22, 35, 55), preparation=(4, 7, 12), after="an even professional gel manicure on all visible nails", before="show clean maintained natural nails without gel color", subtypes=("solid", "sheer", "chrome"), materials=("gel_polish",)),
        _component("french_tips", "French tips", "set", (1, 2), (1, 1, 1), material=(2, 4, 8), labor=(10, 18, 30), after="crisp consistent French tips across the full set", before="remove the French tip design while keeping nail length and hand pose fixed", subtypes=("classic", "micro", "deep", "colored"), materials=("gel_polish", "acrylic")),
        _component("detailed_nail_art", "Detailed nail art", "nail", (1, 20), (2, 4, 8), material=(2, 5, 12), labor=(6, 14, 35), after="detailed hand-painted or dimensional art on the specified number of nails", before="show those same nails with a simple solid finish", subtypes=("hand_painted", "3d", "gem", "mixed"), materials=("gel_paint", "charms", "gems"), aliases=("nail_art",)),
        _component("nail_extensions", "Nail extensions", "set", (1, 2), (1, 1, 1), material=(8, 14, 24), labor=(24, 42, 70), preparation=(4, 7, 12), after="consistent professional nail extensions across the full set", before="show clean natural nails with the same hand pose", subtypes=("gel_x", "hard_gel", "acrylic"), materials=("soft_gel", "hard_gel", "acrylic"), aliases=("extensions",)),
    )),
}


_FAMILY_ALIASES: Dict[str, str] = {}
for _family_key, _definition in FAMILIES.items():
    for _alias in (_family_key, _definition.service_key, _definition.label, *_definition.service_aliases):
        if slug(_alias):
            _FAMILY_ALIASES[slug(_alias)] = _family_key


def get_family(pricing_family: object) -> Optional[PricingFamilyDefinition]:
    key = slug(pricing_family)
    resolved = _FAMILY_ALIASES.get(key, key)
    return FAMILIES.get(resolved)


def resolve_pricing_family(*texts: object) -> Optional[str]:
    haystack = " ".join(slug(text).replace("_", " ") for text in texts if str(text or "").strip())
    if not haystack:
        return None
    exact = _FAMILY_ALIASES.get(slug(haystack))
    if exact:
        return exact
    scored: list[tuple[int, int, str]] = []
    for index, (family_key, definition) in enumerate(FAMILIES.items()):
        candidates = (family_key, definition.service_key, definition.label, *definition.service_aliases)
        score = max((len(slug(value)) for value in candidates if slug(value).replace("_", " ") in haystack), default=0)
        if score:
            scored.append((score, -index, family_key))
    return max(scored)[2] if scored else None


def component_alias_map(family: PricingFamilyDefinition) -> Dict[str, str]:
    aliases: Dict[str, str] = {}
    for key, definition in family.components.items():
        for alias in (key, definition.label, *definition.aliases):
            normalized = slug(alias)
            if normalized:
                aliases[normalized] = key
    return aliases


def registry_contract(pricing_family: object) -> Optional[dict]:
    family = get_family(pricing_family)
    if not family:
        return None
    return {
        "version": REGISTRY_VERSION,
        "pricingFamily": family.key,
        "serviceKey": family.service_key,
        "components": [
            {
                "componentKey": component.key,
                "label": component.label,
                "subtypeKeys": list(component.subtypes),
                "materialKeys": list(component.materials),
                "tiers": list(component.tiers),
                "unit": component.quantity.unit,
                "quantityBounds": {"low": component.quantity.minimum, "high": component.quantity.maximum},
                "attributeEnums": {key: list(values) for key, values in component.attributes.items()},
                "afterDescription": component.after_description,
                "beforeStrategy": component.before_strategy,
            }
            for component in family.components.values()
        ],
    }


LAUNCH_PRICING_FAMILIES = frozenset(FAMILIES)


__all__ = [
    "ComponentDefinition",
    "FAMILIES",
    "LAUNCH_PRICING_FAMILIES",
    "PricingFamilyDefinition",
    "PricingRule",
    "QuantityRule",
    "REGISTRY_VERSION",
    "RateBand",
    "TIERS",
    "component_alias_map",
    "get_family",
    "registry_contract",
    "resolve_pricing_family",
    "slug",
]
