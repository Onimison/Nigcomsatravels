/* =========================================
   LOGIN PAGE
========================================= */

const loginForm = document.getElementById("loginForm");

if (loginForm) {

    loginForm.addEventListener("submit", function (event) {

        event.preventDefault();

        const emailInput =
            document.getElementById("email");

        const email =
            emailInput.value.trim();

        if (!email) {
            return;
        }

        /*
         * Store email temporarily.
         * Later your backend will handle this.
         */

        localStorage.setItem(
            "nigcomsatEmail",
            email
        );

        window.location.href = "verify.html";

    });

}


/* =========================================
   VERIFY PAGE
========================================= */

const verifyForm =
    document.getElementById("verifyForm");

if (verifyForm) {

    const otpInputs =
        document.querySelectorAll(".otp-input");

    const errorMessage =
        document.getElementById(
            "verificationError"
        );

    const emailDisplay =
        document.getElementById("userEmail");


    /* Display saved email */

    const savedEmail =
        localStorage.getItem(
            "nigcomsatEmail"
        );

    if (savedEmail && emailDisplay) {

        emailDisplay.textContent =
            savedEmail;

    }


    /* =====================================
       OTP INPUT BEHAVIOUR
    ====================================== */

    otpInputs.forEach(function (input, index) {

        input.addEventListener(
            "input",
            function () {

                /*
                 * Only allow numbers
                 */

                this.value =
                    this.value.replace(
                        /[^0-9]/g,
                        ""
                    );


                /*
                 * Remove error
                 */

                this.classList.remove(
                    "error"
                );

                if (errorMessage) {

                    errorMessage.classList.add(
                        "hidden"
                    );

                }


                /*
                 * Move to next box
                 */

                if (
                    this.value &&
                    index < otpInputs.length - 1
                ) {

                    otpInputs[
                        index + 1
                    ].focus();

                }

            }
        );


        /* Backspace */

        input.addEventListener(
            "keydown",
            function (event) {

                if (
                    event.key === "Backspace" &&
                    !this.value &&
                    index > 0
                ) {

                    otpInputs[
                        index - 1
                    ].focus();

                }

            }
        );


        /* Paste */

        input.addEventListener(
            "paste",
            function (event) {

                event.preventDefault();

                const pasted =
                    event.clipboardData
                        .getData("text")
                        .replace(
                            /[^0-9]/g,
                            ""
                        )
                        .slice(0, 6);


                pasted
                    .split("")
                    .forEach(
                        function (digit, i) {

                            if (
                                otpInputs[i]
                            ) {

                                otpInputs[i]
                                    .value = digit;

                            }

                        }
                    );


                if (pasted.length === 6) {

                    otpInputs[5].focus();

                }

            }
        );

    });


    /* =====================================
       VERIFY
    ====================================== */

    verifyForm.addEventListener(
        "submit",
        function (event) {

            event.preventDefault();


            let code = "";

            otpInputs.forEach(
                function (input) {

                    code += input.value;

                }
            );


            /*
             * Demo verification.
             *
             * Correct code:
             * 123456
             *
             * Replace this with
             * backend API authentication.
             */

            if (code !== "123456") {

                otpInputs.forEach(
                    function (input) {

                        input.classList.add(
                            "error"
                        );

                    }
                );


                errorMessage.classList.remove(
                    "hidden"
                );

                return;

            }


            /*
             * Successful verification
             */

            localStorage.setItem(
                "verificationStatus",
                "verified"
            );


            window.location.href =
                "verification-success.html";

        }
    );


    /* =====================================
       BACK BUTTON
    ====================================== */

    const backButton =
        document.getElementById(
            "backButton"
        );

    if (backButton) {

        backButton.addEventListener(
            "click",
            function () {

                window.location.href =
                    "login.html";

            }
        );

    }


    /* =====================================
       COUNTDOWN
    ====================================== */

    const countdown =
        document.getElementById(
            "countdown"
        );

    if (countdown) {

        let seconds = 14;

        const timer =
            setInterval(
                function () {

                    seconds--;

                    const formatted =
                        `0:${String(
                            seconds
                        ).padStart(2, "0")}`;

                    countdown.textContent =
                        formatted;


                    if (seconds <= 0) {

                        clearInterval(timer);

                        countdown.textContent =
                            "Ready";

                    }

                },
                1000
            );

    }

}


/* =========================================
   SUCCESS PAGE
========================================= */

const dashboardButton =
    document.getElementById(
        "dashboardButton"
    );

if (dashboardButton) {

    dashboardButton.addEventListener(
        "click",
        function () {

            /*
             * Your real dashboard page
             * will replace this.
             */

            window.location.href =
                "../dashboard/dashboard.html";

        }
    );

}