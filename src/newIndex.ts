let poolContainer = document.querySelector("#generic-pool-container")! as HTMLElement;
let showAndHideVisibilityTool = document.querySelector("#generic-pool-container .visual-tool-expanding-indication-hidden")! as HTMLElement;
let infoIcon = document.querySelector("#token-header .information-icon-container")! as HTMLElement;
let poolStats = document.querySelector("#token-pool-stats")! as HTMLElement;
let expandPoolButton = document.querySelector("#generic-pool-container .expand-button")! as HTMLElement;
let hidePoolButton = document.querySelector("#generic-pool-container .hide-button")! as HTMLElement;
let stakingUnstakingContainer = document.querySelector("#generic-pool-container #staking-unstaking-container")! as HTMLElement;
let stakingButton = document.querySelector("#generic-pool-container .staking")! as HTMLElement;
let unstakingButton = document.querySelector("#generic-pool-container .unstaking")! as HTMLElement;
let staking = document.querySelector("#generic-pool-container .main-staking")! as HTMLElement;
let unstaking = document.querySelector("#generic-pool-container .main-unstaking")! as HTMLElement;


poolContainer.addEventListener("mouseover", showOrHideElement(showAndHideVisibilityTool));
poolContainer.addEventListener("mouseout", showOrHideElement(showAndHideVisibilityTool));

infoIcon.addEventListener("mouseover", showOrHideElement(poolStats));
infoIcon.addEventListener("mouseout", showOrHideElement(poolStats));

expandPoolButton.addEventListener("click", showOrHideElement(expandPoolButton));
expandPoolButton.addEventListener("click", showOrHideElement(hidePoolButton));
expandPoolButton.addEventListener("click", showOrHideElement(stakingUnstakingContainer));

hidePoolButton.addEventListener("click", showOrHideElement(expandPoolButton));
hidePoolButton.addEventListener("click", showOrHideElement(hidePoolButton));
hidePoolButton.addEventListener("click", showOrHideElement(stakingUnstakingContainer));

stakingButton.addEventListener("click", showElementHideAnother(staking, unstaking));
stakingButton.addEventListener("click", setActiveColor);
stakingButton.addEventListener("click", cancelActiveColor(unstakingButton));

unstakingButton.addEventListener("click", showElementHideAnother(unstaking, staking));
unstakingButton.addEventListener("click", setActiveColor);
unstakingButton.addEventListener("click", cancelActiveColor(stakingButton));

function showOrHideElement(elementToShow: HTMLElement){
    return function (event: Event){
        event.preventDefault();
        elementToShow.classList.toggle("hide");
    }
}

// Careful with this function.
function showElementHideAnother(elementToShow: HTMLElement, elementToHide: HTMLElement){
    return function (event: Event){
        event.preventDefault();
        elementToShow.classList.remove("hide");
        elementToHide.classList.add("hide");
    }
}

function setActiveColor(event){
    event.target.classList.add("active");
}

function cancelActiveColor(elementToDisplayAsNotActive){
    return function(event){
        event.preventDefault();
        elementToDisplayAsNotActive.classList.remove("active");
    }
}