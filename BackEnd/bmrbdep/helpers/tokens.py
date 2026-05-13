from itsdangerous import URLSafeTimedSerializer, SignatureExpired, URLSafeSerializer, BadData, BadSignature

import bmrbdep


def get_email_token(email: str) -> str:
    """ Generate a time-limited token for email verification for sake of accessing all user depositions. """

    return URLSafeTimedSerializer(bmrbdep.application.secret_key).dumps({'email': email}, salt='email-verification')


def get_deposition_token(deposition_id: str) -> str:
    """ Generate a token used to access a particular deposition and validate the e-mail associated with it. """

    return URLSafeSerializer(bmrbdep.application.secret_key).dumps({'deposition_id': deposition_id}, salt='deposition-access')


def verify_email_token(token, max_age=3600) -> str:
    """
    Verify and decode an email verification token.
    
    Args:
        token (str): The token to verify
        max_age (int): Maximum age of token in seconds (default: 1 hour)
    
    Returns:
        str or None: The email address if the token is valid, None if invalid/expired
    """
    serializer = URLSafeTimedSerializer(bmrbdep.application.secret_key)

    try:
        email = serializer.loads(token, salt='email-verification', max_age=max_age)
        return email['email']
    except SignatureExpired:
        raise bmrbdep.RequestError(f'Your access token has expired. Please request a new one.')
    except Exception:
        raise bmrbdep.RequestError('Invalid e-mail validation token.')


def verify_deposition_token(token) -> str:
    """ Verify a deposition access token. Raises an exception if invalid otherwise returns the deposition ID. """

    serializer = URLSafeSerializer(bmrbdep.application.secret_key)
    try:
        deposition_data = serializer.loads(token, salt='deposition-access')
        return deposition_data['deposition_id']
    except BadSignature:
        try:
            # These tokens - from before late 2025 - did not have a salt. We don't want to invalidate them
            #  because we added a salt for extra security going forward. As we don't use "deposition_id" in tokens
            #   in any other context, an attacker shouldn't be able to do anything malicious with these tokens.
            deposition_data = serializer.loads(token)
            return deposition_data['deposition_id']
        except Exception:
            raise bmrbdep.RequestError('Invalid token. Please request a new e-mail validation message or contact support.')

    except (BadData, KeyError, TypeError):
        raise bmrbdep.RequestError('Invalid token. Please request a new e-mail validation message or contact support.')
