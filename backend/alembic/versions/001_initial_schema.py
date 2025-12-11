"""Initial schema

Revision ID: 001
Revises: 
Create Date: 2025-12-01

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = '001'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'rooms',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(length=100), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('name')
    )
    op.create_index(op.f('ix_rooms_id'), 'rooms', ['id'], unique=False)

    op.create_table(
        'game_sessions',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('room_id', sa.Integer(), nullable=False),
        sa.Column('start_time', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('end_time', sa.DateTime(timezone=True), nullable=True),
        sa.Column('expected_players', sa.Integer(), nullable=True, default=1),
        sa.Column('connected_players', sa.Integer(), nullable=True, default=0),
        sa.ForeignKeyConstraint(['room_id'], ['rooms.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_game_sessions_id'), 'game_sessions', ['id'], unique=False)

    op.create_table(
        'elements',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('room_id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(length=100), nullable=False),
        sa.Column('type', sa.Enum('sensor', 'actuator', 'logic', 'switch', 'servo', 'light', 'relay', 'door', 'lock', 'display', 'speaker', 'rfid', 'keypad', 'button', 'led', 'motor', name='elementtype'), nullable=False),
        sa.Column('mqtt_topic', sa.String(length=255), nullable=True),
        sa.Column('current_state', sa.JSON(), nullable=True, default={}),
        sa.ForeignKeyConstraint(['room_id'], ['rooms.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_elements_id'), 'elements', ['id'], unique=False)

    op.create_table(
        'events',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('element_id', sa.Integer(), nullable=False),
        sa.Column('session_id', sa.Integer(), nullable=True),
        sa.Column('timestamp', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('action', sa.String(length=100), nullable=False),
        sa.Column('value', sa.JSON(), nullable=True, default={}),
        sa.ForeignKeyConstraint(['element_id'], ['elements.id'], ),
        sa.ForeignKeyConstraint(['session_id'], ['game_sessions.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_events_id'), 'events', ['id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_events_id'), table_name='events')
    op.drop_table('events')
    op.drop_index(op.f('ix_elements_id'), table_name='elements')
    op.drop_table('elements')
    op.drop_index(op.f('ix_game_sessions_id'), table_name='game_sessions')
    op.drop_table('game_sessions')
    op.drop_index(op.f('ix_rooms_id'), table_name='rooms')
    op.drop_table('rooms')
    op.execute('DROP TYPE IF EXISTS elementtype')
