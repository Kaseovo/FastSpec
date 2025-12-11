"""
Database migration script to add authentication tables and user ownership
Run this script once to migrate from the old schema to the new one with authentication
"""

import os
import sys
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

# Add parent directory to path to import modules
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.database import Base, DATABASE_URL
from backend.models import User, OpenAPISpec


def migrate_database():
    """
    Migrate database to add authentication support
    """
    engine = create_engine(
        DATABASE_URL,
        connect_args={"check_same_thread": False} if "sqlite" in DATABASE_URL else {},
    )
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

    print("Starting database migration...")

    # Create all tables (will create new ones, skip existing)
    print("Creating new tables...")
    Base.metadata.create_all(bind=engine)

    db = SessionLocal()

    try:
        # Check if users table exists and has data
        result = db.execute(text("SELECT COUNT(*) FROM users")).scalar()

        if result == 0:
            print("No users found. Creating default system user...")
            # Create a system user for existing specs
            system_user = User(
                email="system@fastspec.local",
                name="System User",
                avatar_url=None,
                provider="system",
                provider_user_id="0",
            )
            db.add(system_user)
            db.commit()
            db.refresh(system_user)
            print(f"Created system user with ID: {system_user.id}")

            # Check if there are specs without user_id
            try:
                specs_result = db.execute(
                    text("SELECT COUNT(*) FROM openapi_specs WHERE user_id IS NULL")
                ).scalar()
                if specs_result > 0:
                    print(
                        f"Found {specs_result} specs without user ownership. Assigning to system user..."
                    )
                    db.execute(
                        text(
                            f"UPDATE openapi_specs SET user_id = {system_user.id} WHERE user_id IS NULL"
                        )
                    )
                    db.commit()
                    print("Migration completed successfully!")
            except Exception as e:
                print(f"Note: {e}")
                print("This is expected if the user_id column doesn't exist yet.")
        else:
            print(
                f"Found {result} existing users. No migration needed for users table."
            )

        print("\n" + "=" * 50)
        print("Migration Summary:")
        print("=" * 50)
        users_count = db.execute(text("SELECT COUNT(*) FROM users")).scalar()
        specs_count = db.execute(text("SELECT COUNT(*) FROM openapi_specs")).scalar()
        print(f"Total users: {users_count}")
        print(f"Total specs: {specs_count}")
        print("=" * 50)

    except Exception as e:
        print(f"Error during migration: {e}")
        db.rollback()
        raise
    finally:
        db.close()

    print("\nMigration completed! You can now start the application.")
    print("\nIMPORTANT: Don't forget to:")
    print("1. Install new dependencies: pip install -r requirements.txt")
    print("2. Set up OAuth credentials in .env file")
    print("3. Configure GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET")
    print("4. Configure GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET")


if __name__ == "__main__":
    migrate_database()
