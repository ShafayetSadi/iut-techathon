from fastapi import HTTPException


def not_found(message: str, **details: object) -> HTTPException:
    return HTTPException(
        status_code=404,
        detail={"error": {"code": "not_found", "message": message, "details": details}},
    )


def validation_error(message: str, **details: object) -> HTTPException:
    return HTTPException(
        status_code=422,
        detail={"error": {"code": "validation_error", "message": message, "details": details}},
    )
