#!/usr/bin/env python3
"""
GLB Model Preprocessor for Escape Room 3D

This script preprocesses GLB models to make them ready for immediate use
in the React/Three.js application without needing runtime adjustments.

What it does:
1. Centers the model on the origin (0, 0, 0)
2. Puts the floor at Y=0
3. Applies a scale factor (default 7x for kitchen)
4. Validates that POSIZIONE_INIZIALE is inside the model bounds
5. Optionally moves POSIZIONE_INIZIALE to the center of the room (--auto-spawn)
6. Exports a new "clean" GLB file

Usage:
    python preprocess_glb.py input.glb output.glb [--scale 7] [--auto-spawn]

Requirements:
    pip install trimesh pygltflib numpy
"""

import argparse
import sys
import numpy as np

try:
    import trimesh
except ImportError:
    print("Error: trimesh not installed. Run: pip install trimesh pygltflib numpy")
    sys.exit(1)


def find_node_by_name(scene, name_pattern):
    """Find a node in the scene graph by name pattern (case-insensitive)."""
    name_pattern_upper = name_pattern.upper()
    
    for node_name in scene.graph.nodes:
        if name_pattern_upper in node_name.upper():
            return node_name
    
    return None


def get_node_world_position(scene, node_name):
    """Get the world position of a node."""
    try:
        transform, _ = scene.graph.get(node_name)
        # Extract translation from the 4x4 transform matrix
        position = transform[:3, 3]
        return position
    except Exception as e:
        print(f"Warning: Could not get position for node '{node_name}': {e}")
        return None


def set_node_position(scene, node_name, new_position):
    """Set the world position of a node."""
    try:
        transform, geometry_name = scene.graph.get(node_name)
        # Create new transform with updated position
        new_transform = transform.copy()
        new_transform[:3, 3] = new_position
        # Update the node in the graph
        scene.graph.update(frame_to=node_name, matrix=new_transform, geometry=geometry_name)
        return True
    except Exception as e:
        print(f"Warning: Could not set position for node '{node_name}': {e}")
        return False


def preprocess_glb(input_path, output_path, scale_factor=7.0, auto_spawn=False, verbose=True):
    """
    Preprocess a GLB model for the escape room application.
    
    Args:
        input_path: Path to input GLB file
        output_path: Path to output GLB file
        scale_factor: Scale factor to apply (default 7.0 for kitchen)
        auto_spawn: If True, move POSIZIONE_INIZIALE to center of room on floor
        verbose: Print progress messages
    """
    if verbose:
        print(f"Loading model: {input_path}")
    
    # Load the GLB as a scene (preserves hierarchy and names)
    scene = trimesh.load(input_path, force='scene')
    
    if verbose:
        print(f"Loaded scene with {len(scene.geometry)} geometries")
        print(f"Node names: {list(scene.graph.nodes)[:20]}...")  # First 20 nodes
    
    # Get the bounding box of the entire scene
    bounds = scene.bounds
    if bounds is None:
        print("Error: Could not compute scene bounds")
        return False
    
    min_bounds = bounds[0]
    max_bounds = bounds[1]
    
    if verbose:
        print(f"Original bounds:")
        print(f"  Min: {min_bounds}")
        print(f"  Max: {max_bounds}")
        print(f"  Size: {max_bounds - min_bounds}")
    
    # Calculate center (X, Z) and floor (Y)
    center_x = (min_bounds[0] + max_bounds[0]) / 2
    center_z = (min_bounds[2] + max_bounds[2]) / 2
    floor_y = min_bounds[1]
    
    if verbose:
        print(f"\nTransformations to apply:")
        print(f"  Center X: {-center_x}")
        print(f"  Floor Y: {-floor_y}")
        print(f"  Center Z: {-center_z}")
        print(f"  Scale: {scale_factor}")
    
    # Create transformation matrix:
    # 1. First translate to center and put floor at Y=0
    # 2. Then scale
    translation = np.array([
        [1, 0, 0, -center_x],
        [0, 1, 0, -floor_y],
        [0, 0, 1, -center_z],
        [0, 0, 0, 1]
    ])
    
    scale = np.array([
        [scale_factor, 0, 0, 0],
        [0, scale_factor, 0, 0],
        [0, 0, scale_factor, 0],
        [0, 0, 0, 1]
    ])
    
    # Combined transform: scale * translate (apply translation first, then scale)
    transform = scale @ translation
    
    # Apply the transformation to the scene
    scene.apply_transform(transform)
    
    # Verify new bounds
    new_bounds = scene.bounds
    if verbose:
        print(f"\nNew bounds after transformation:")
        print(f"  Min: {new_bounds[0]}")
        print(f"  Max: {new_bounds[1]}")
        print(f"  Size: {new_bounds[1] - new_bounds[0]}")
    
    # Calculate center of room on floor (for auto-spawn)
    new_min = new_bounds[0]
    new_max = new_bounds[1]
    room_center_x = (new_min[0] + new_max[0]) / 2
    room_center_z = (new_min[2] + new_max[2]) / 2
    floor_height = 0.1  # Slightly above floor to avoid clipping
    
    # Check for POSIZIONE_INIZIALE
    posizione_node = find_node_by_name(scene, 'POSIZIONE_INIZIALE')
    if posizione_node:
        pos = get_node_world_position(scene, posizione_node)
        if pos is not None:
            if verbose:
                print(f"\nPOSIZIONE_INIZIALE found: '{posizione_node}'")
                print(f"  Current position: {pos}")
            
            # Check if it's inside the bounds
            inside_x = new_min[0] <= pos[0] <= new_max[0]
            inside_z = new_min[2] <= pos[2] <= new_max[2]
            
            if auto_spawn:
                # Move POSIZIONE_INIZIALE to center of room on floor
                new_pos = np.array([room_center_x, floor_height, room_center_z])
                if set_node_position(scene, posizione_node, new_pos):
                    print(f"  AUTO-SPAWN: Moved to center of room: [{room_center_x:.2f}, {floor_height:.2f}, {room_center_z:.2f}]")
                else:
                    print(f"  WARNING: Failed to move POSIZIONE_INIZIALE")
            elif inside_x and inside_z:
                print(f"  Status: OK - Inside model bounds")
            else:
                print(f"  WARNING: POSIZIONE_INIZIALE is OUTSIDE model bounds!")
                print(f"    X in range [{new_min[0]:.2f}, {new_max[0]:.2f}]: {inside_x}")
                print(f"    Z in range [{new_min[2]:.2f}, {new_max[2]:.2f}]: {inside_z}")
                print(f"    TIP: Use --auto-spawn to move it to the center of the room")
    else:
        print("\nWARNING: POSIZIONE_INIZIALE not found in model!")
        if auto_spawn:
            print(f"  Cannot auto-spawn: node not found in model")
        print("  The player spawn point will use fallback position.")
    
    # Check for MANIGLIA_PORTA (fallback spawn)
    maniglia_node = find_node_by_name(scene, 'MANIGLIA_PORTA')
    if maniglia_node:
        pos = get_node_world_position(scene, maniglia_node)
        if pos is not None and verbose:
            print(f"\nMANIGLIA_PORTA found: '{maniglia_node}'")
            print(f"  World position: {pos}")
    
    # Export the preprocessed model
    if verbose:
        print(f"\nExporting to: {output_path}")
    
    scene.export(output_path)
    
    if verbose:
        print("Done!")
        print("\n" + "="*60)
        print("NEXT STEPS:")
        print("="*60)
        print("1. Replace your original GLB with the preprocessed one")
        print("2. In your React code, remove or set to 1:")
        print("   - KITCHEN_SCALE = 1")
        print("   - MODEL_Y_OFFSET = 0")
        print("3. The model is now centered with floor at Y=0")
        print("="*60)
    
    return True


def main():
    parser = argparse.ArgumentParser(
        description='Preprocess GLB models for Escape Room 3D',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
    python preprocess_glb.py cucina.glb cucina_processed.glb
    python preprocess_glb.py cucina.glb cucina_processed.glb --scale 7
    python preprocess_glb.py cucina.glb cucina_processed.glb --auto-spawn
    python preprocess_glb.py esterno.glb esterno_processed.glb --scale 1 --auto-spawn
        """
    )
    
    parser.add_argument('input', help='Input GLB file path')
    parser.add_argument('output', help='Output GLB file path')
    parser.add_argument('--scale', type=float, default=7.0,
                        help='Scale factor to apply (default: 7.0)')
    parser.add_argument('--auto-spawn', action='store_true',
                        help='Automatically move POSIZIONE_INIZIALE to center of room on floor')
    parser.add_argument('--quiet', action='store_true',
                        help='Suppress progress messages')
    
    args = parser.parse_args()
    
    success = preprocess_glb(
        args.input,
        args.output,
        scale_factor=args.scale,
        auto_spawn=args.auto_spawn,
        verbose=not args.quiet
    )
    
    sys.exit(0 if success else 1)


if __name__ == '__main__':
    main()
